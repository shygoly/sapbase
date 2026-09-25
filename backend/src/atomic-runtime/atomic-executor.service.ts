import { Injectable } from '@nestjs/common'
import {
  assertNotRevoked,
  type RevocationList,
} from '@speckit/wasm-modules'
import { AtomicRegistryService } from '../atomic-registry/atomic-registry.service'
import { AtomicImplementationKind } from '../atomic-registry/atomic-implementation.entity'
import { AtomicRuntimeError } from './atomic-runtime.error'
import { OUTPUT_GATE_ERROR_CODE } from './atomic-runtime.error'
import { missingPermissions } from './atomic-permissions'
import {
  GATE_MAX_REPLAY_ROWS,
  firstFailedVerdict,
  gateDeclarationOf,
  judgeOutput,
  type GateRun,
  type OutputGateReport,
} from './output-gate'
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
  /** 闸 3 判定报告（档位、逐条判定、信号、实际内核回合数）。 */
  outputGate: OutputGateReport
}

interface Projection {
  input: Int32Array
  rows: number
  columnNames: string[]
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

    // 执行前先挡一次"按声明上限就装不下"的输出（省掉一次注定失败的执行）；
    // 实际字节数的判定仍归闸 3 的 O3 —— 这一句是提前退出，不是第二条判据。
    let fallbackSeen = false
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

    // ── 闸 3：输出管控 ─────────────────────────────────────────────
    // 批量那一次已经跑完，这里按档位补跑"逐行"与"置换"两类重放，然后把三次结果
    // 一起交给 output-gate —— 判定只有那一处实现，执行器不再自己判任何一条。
    const declaration = gateDeclarationOf(contract)
    const batch: GateRun = { values: raw, rows: projection.rows }
    let rounds = 1
    let fuelTotal = fuelUsed

    const replay = async (
      records: Array<Record<string, number>>,
    ): Promise<GateRun> => {
      const replayProjection = this.project(contract, records)
      const replayLength =
        replayProjection.columnNames.length * replayProjection.rows +
        (replayProjection.totalName ? 1 : 0)
      const { out, fuelUsed: replayFuel, engineFallback: replayFallback } =
        await this.runInSandbox(
          sha256,
          bytes,
          replayProjection,
          replayLength,
          request.timeoutMs,
          request.fuel ?? (contract.cpuBudget ? Number(contract.cpuBudget) : undefined),
        )
      rounds += 1
      if (replayFuel !== undefined) fuelTotal = (fuelTotal ?? 0) + replayFuel
      if (replayFallback) fallbackSeen = true
      return { values: out, rows: replayProjection.rows }
    }

    // 重放上限是**成本**约束：逐行重放是 n 次执行。超出上限时只判前 N 行，
    // 报告里写明 rowsJudged（确定性截断，不是抽样）。
    const judgedRows = Math.min(projection.rows, GATE_MAX_REPLAY_ROWS)

    let perRow: GateRun | undefined
    if (declaration.profile !== 'off' && projection.rows >= 2) {
      const values = new Int32Array(
        projection.columnNames.length * judgedRows + (projection.totalName ? 1 : 0),
      )
      let total = 0
      for (let r = 0; r < judgedRows; r += 1) {
        const single = await replay([request.records[r]])
        projection.columnNames.forEach((_name, ci) => {
          values[ci * judgedRows + r] = single.values[ci]
        })
        if (projection.totalName) total += single.values[projection.columnNames.length]
      }
      if (projection.totalName) {
        values[projection.columnNames.length * judgedRows] = total
      }
      perRow = { values, rows: judgedRows }
    }

    // O5 只在声明可交换后才判；`strict` 档位下同样会跑（档位是"更严"，不是"更多声明"）。
    let permuted: { run: GateRun; permutation: number[] } | undefined
    if (
      declaration.profile !== 'off' &&
      declaration.commutative &&
      projection.rows >= 2
    ) {
      // 置换必须是**确定性**的（判据不许有随机）：这里用倒序。
      const permutation = Array.from({ length: judgedRows }, (_v, i) => judgedRows - 1 - i)
      const records = permutation.map((source) => request.records[source])
      permuted = { run: await replay(records), permutation }
    }

    const outputGate = judgeOutput({
      declaration,
      batch,
      perRow,
      permuted,
      rounds,
    })
    const failure = firstFailedVerdict(outputGate)
    if (failure) {
      // fail-closed：命中判决即**不返回结果**（不是"警告后放行"）
      throw new AtomicRuntimeError(
        OUTPUT_GATE_ERROR_CODE[failure.criterion],
        `[atomic.output.${failure.criterion}] ${failure.detail}`,
        `atomic.output.${failure.criterion}`,
      )
    }

    const columns: Record<string, number[]> = {}
    for (const name of projection.columnNames) columns[name] = []
    for (let r = 0; r < projection.rows; r += 1) {
      projection.columnNames.forEach((name, ci) => {
        columns[name].push(raw[ci * projection.rows + r])
      })
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
      outputGate,
    }
    if (projection.totalName) {
      result.total = raw[projection.columnNames.length * projection.rows]
    }
    // 闸 3 的重放计入同一预算，不额外放宽 —— 报告里的 rounds 让"贵了多少"可查
    if (fuelTotal !== undefined) {
      result.fuelUsed = fuelTotal
    }
    if (engineFallback || fallbackSeen) {
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
