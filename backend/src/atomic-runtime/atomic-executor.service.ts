import { Injectable } from '@nestjs/common'
import {
  assertNotRevoked,
  type RevocationList,
} from '@speckit/wasm-modules'
import { AtomicRegistryService } from '../atomic-registry/atomic-registry.service'
import { AtomicImplementationKind } from '../atomic-registry/atomic-implementation.entity'
import { AtomicRuntimeError } from './atomic-runtime.error'
import { missingPermissions } from './atomic-permissions'
import { WasmModuleLoader } from './wasm-module-loader'
import { WasmModuleVerifier } from './wasm-module-verifier'
import {
  type WasmEngine,
  WasmExecutionTimeout,
  WasmEngineFailure,
} from './wasm-engine'

const DEFAULT_TIMEOUT_MS = 2000
const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024

export interface AtomicInvocationRequest {
  atomicType: string
  version: string
  /** 行记录。字段名对应契约 inputSchema.columns[].source 的最后一段。 */
  records: Array<Record<string, number>>
  timeoutMs?: number
  /** 吊销名单（M5 负责同步机制；这里先执行"命中即拒"）。 */
  revocationList?: RevocationList
  /** 调用方已持有的权限点（来自 JWT）。契约声明的权限必须**全部**满足。 */
  grantedPermissions?: readonly string[]
  /** 指令预算覆盖（缺省取契约 cpuBudget 或平台默认）。 */
  fuel?: number
}

export interface AtomicInvocationResult {
  atomicType: string
  contractVersion: string
  moduleSha256: string
  rows: number
  columns: Record<string, number[]>
  total?: number
  elapsedMs: number
  gateChecks: string[]
  /** 实际执行引擎（v8 / wasmtime）——写进审计，便于事后区分。 */
  engine: string
  /** 实际消耗的指令数（引擎支持时返回）：预算校准与计费的依据。 */
  fuelUsed?: number
  /** 本次结果是否来自回退引擎（默认无回退配置时为 undefined）。 */
  engineFallback?: boolean
}

interface Projection {
  input: Int32Array
  rows: number
  columnNames: string[]
  /** 契约声明的输出值域（缺省表示不限制）。 */
  bounds: Array<{ name: string; minimum?: number; maximum?: number }>
  totalName?: string
  maxOutputBytes: number
}

/**
 * 宿主侧 Wasm 原子执行器。
 *
 * 顺序固定：解析契约 → 吊销检查 → 取字节 → 验哈希与闸 → 投影输入 → Worker 执行 → 校验输出。
 * 任一步失败都**抛错，绝不回退到内置实现**（元语不变量 4）。
 */
@Injectable()
export class AtomicExecutor {
  constructor(
    private readonly registry: AtomicRegistryService,
    private readonly loader: WasmModuleLoader,
    private readonly verifier: WasmModuleVerifier,
    private readonly pool: WasmEngine,
  ) {}

  async invoke(
    request: AtomicInvocationRequest,
  ): Promise<AtomicInvocationResult> {
    const startedAt = Date.now()
    const { contract, implementation } = await this.registry.resolve(
      request.atomicType,
      request.version,
    )

    if (implementation.kind !== AtomicImplementationKind.WASM) {
      throw new AtomicRuntimeError(
        'UNSUPPORTED_IMPLEMENTATION',
        `v1 执行器只跑 Wasm 实现，当前为 ${implementation.kind}`,
      )
    }

    // design.md 执行流程第 3 步：权限是**执行前检查**的一部分 ——
    // 与吊销、状态、输入校验同一组，任一不过即拒且不回退。
    const missing = missingPermissions(
      contract.permissions ?? [],
      request.grantedPermissions ?? [],
    )
    if (missing.length > 0) {
      throw new AtomicRuntimeError(
        'PERMISSION_DENIED',
        `调用 ${contract.atomicType} 需要权限：${missing.join(', ')}（契约声明的权限点必须全部满足）`,
      )
    }
    const sha256 = implementation.moduleSha256
    if (!sha256) {
      throw new AtomicRuntimeError(
        'UNSUPPORTED_IMPLEMENTATION',
        'Wasm 实现缺少 moduleSha256，无法指认要执行的代码',
      )
    }

    if (request.revocationList) {
      try {
        assertNotRevoked(request.revocationList, sha256)
      } catch (error) {
        throw new AtomicRuntimeError(
          'MODULE_REVOKED',
          `模块已吊销，拒绝执行且不回退：${(error as Error).message}`,
        )
      }
    }

    const bytes = this.loader.load(sha256)
    const gate = this.verifier.verify(bytes, sha256)
    const projection = this.project(contract, request.records)

    const outLength =
      projection.columnNames.length * projection.rows +
      (projection.totalName ? 1 : 0)
    if (outLength * 4 > projection.maxOutputBytes) {
      throw new AtomicRuntimeError(
        'OUTPUT_LIMIT_EXCEEDED',
        `输出需要 ${outLength * 4} 字节，超过契约上限 ${projection.maxOutputBytes}`,
      )
    }

    const { out: raw, fuelUsed, engineFallback } = await this.runInSandbox(
      sha256,
      bytes,
      projection,
      outLength,
      request.timeoutMs,
      // 预算优先级：显式请求 > 契约 cpuBudget > 引擎默认
      request.fuel ??
        (contract.cpuBudget ? Number(contract.cpuBudget) : undefined),
    )

    const columns: Record<string, number[]> = {}
    for (const name of projection.columnNames) columns[name] = []
    for (let r = 0; r < projection.rows; r += 1) {
      projection.columnNames.forEach((name, ci) => {
        columns[name].push(raw[ci * projection.rows + r])
      })
    }
    // 值域校验：契约声明了 minimum/maximum 就必须落在范围内 ——
    // 这是"输出通道管控"里可判定的那一半（低熵判据仍未移植，见 design.md 安全边界表）。
    for (const bound of projection.bounds) {
      for (const value of columns[bound.name] ?? []) {
        if (
          (bound.minimum !== undefined && value < bound.minimum) ||
          (bound.maximum !== undefined && value > bound.maximum)
        ) {
          throw new AtomicRuntimeError(
            'OUTPUT_OUT_OF_RANGE',
            `输出 ${bound.name}=${value} 超出契约值域 [${bound.minimum ?? '-∞'}, ${bound.maximum ?? '+∞'}]`,
          )
        }
      }
    }

    const result: AtomicInvocationResult = {
      atomicType: contract.atomicType,
      contractVersion: contract.version,
      moduleSha256: sha256,
      rows: projection.rows,
      columns,
      elapsedMs: Date.now() - startedAt,
      gateChecks: gate.checks,
      engine: this.pool.name(),
    }
    if (projection.totalName) {
      result.total = raw[projection.columnNames.length * projection.rows]
    }
    if (fuelUsed !== undefined) {
      result.fuelUsed = fuelUsed
    }
    if (engineFallback) {
      result.engineFallback = true
    }
    return result
  }

  /** 当前引擎标识（失败审计也要记，便于分辨是哪个引擎出的问题）。 */
  engineName(): string {
    return this.pool.name()
  }

  /** 把行记录投影成**整数列**（列优先），标识类字段不进模块。 */
  private project(
    contract: { inputSchema: unknown; outputSchema: unknown },
    records: Array<Record<string, number>>,
  ): Projection {
    const inputSchema = contract.inputSchema as {
      rows?: { max?: number }
      columns: Array<{ name: string; source: string }>
    }
    const outputSchema = contract.outputSchema as {
      columns: Array<{ name: string; minimum?: number; maximum?: number }>
      total?: { name: string }
      maxOutputBytes?: number
    }

    const maxRows = inputSchema.rows?.max ?? 100000
    if (records.length > maxRows) {
      throw new AtomicRuntimeError(
        'INVALID_INPUT',
        `行数 ${records.length} 超过契约上限 ${maxRows}`,
      )
    }

    const columnNames = outputSchema.columns.map((c) => c.name)
    const input = new Int32Array(inputSchema.columns.length * records.length)
    inputSchema.columns.forEach((column, ci) => {
      const field = column.source.split('.').pop() as string
      records.forEach((record, ri) => {
        const value = record[field]
        if (!Number.isInteger(value)) {
          throw new AtomicRuntimeError(
            'INVALID_INPUT',
            `第 ${ri} 行的 ${field} 必须是整数（ABI v1 只支持 i32），实际 ${value}`,
          )
        }
        input[ci * records.length + ri] = value as number
      })
    })

    return {
      input,
      rows: records.length,
      columnNames,
      bounds: outputSchema.columns.map((c) => ({
        name: c.name,
        minimum: c.minimum,
        maximum: c.maximum,
      })),
      totalName: outputSchema.total?.name,
      maxOutputBytes: outputSchema.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES,
    }
  }

  /**
   * 在常驻 Worker 的沙箱里执行。
   *
   * 缓存键是模块哈希：同一模块复用 Worker 与已编译模块，**但每次调用都新建内存与实例**
   * （不共享上一次的全局状态）。超时 → 该 Worker 被终止并摘除，下一次调用重建。
   */
  private async runInSandbox(
    moduleSha256: string,
    bytes: Uint8Array,
    projection: Projection,
    outLength: number,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fuel?: number,
  ): Promise<{
    out: Int32Array
    fuelUsed?: number
    engineFallback?: boolean
  }> {
    const inOff = 0
    const outOff = projection.input.length * 4

    try {
      const result = await this.pool.run({
        key: moduleSha256,
        bytes,
        input: projection.input,
        rows: projection.rows,
        inOff,
        outOff,
        outLength,
        timeoutMs,
        fuel,
      })
      if (result.rc !== 0) {
        throw new AtomicRuntimeError(
          'ATOMIC_FAILED',
          `原子返回非 0（${result.rc}），按契约拒绝且不回退`,
        )
      }
      return {
        out: result.out,
        fuelUsed: result.fuelUsed,
        engineFallback: result.engineFallback,
      }
    } catch (error) {
      if (error instanceof WasmExecutionTimeout) {
        throw new AtomicRuntimeError(
          'EXECUTION_TIMEOUT',
          `${error.message}（同进程无法中断死循环，故用 Worker 隔离）`,
        )
      }
      if (error instanceof WasmEngineFailure || error instanceof AtomicRuntimeError) {
        throw error instanceof AtomicRuntimeError
          ? error
          : new AtomicRuntimeError('ATOMIC_FAILED', (error as Error).message)
      }
      throw error
    }
  }
}
