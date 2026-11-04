import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common'
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import {
  type EngineCall,
  type EngineResult,
  type WasmEngine,
  WasmEngineFailure,
  WasmExecutionTimeout,
} from './wasm-engine'

const PROTOCOL_VERSION = 1
const STARTUP_TIMEOUT_MS = 10_000
const DEFAULT_TIMEOUT_MS = 2000
const DEFAULT_FUEL = 1_000_000
const RESTART_BACKOFF_MS = 250
const MAX_BACKOFF_MS = 5_000
const HEALTH_TIMEOUT_MS = 2_000

interface Pending {
  resolve: (value: SidecarMessage) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

interface SidecarMessage {
  t: string
  id?: number
  code?: string
  message?: string
  protocol?: number
  engine?: string
  wasmtime?: string
  cached?: boolean
  rc?: number
  out?: string
  fuel_used?: number
}

/**
 * Wasmtime sidecar 客户端 —— 实现与 V8 池相同的 `WasmEngine` 接口。
 *
 * 与 V8 的差别只在两点：执行发生在**独立进程**（崩溃不带走宿主），
 * 且带**指令预算**（fuel）。契约、ABI、闸、审计、权限都不经过这里。
 *
 * 失败一律**显式**：sidecar 不可用就报错，不静默换引擎（元语不变量 4）。
 */
@Injectable()
export class WasmtimeSidecarClient implements WasmEngine, OnModuleDestroy {
  private readonly logger = new Logger(WasmtimeSidecarClient.name)
  private child?: ChildProcessWithoutNullStreams
  private pending = new Map<number, Pending>()
  private nextId = 1
  private loadedKeys = new Set<string>()
  private starting?: Promise<void>
  private engineVersion = 'unknown'
  /** 连续失败次数：用于退避重启（成功握手后清零）。 */
  private failures = 0
  /** 退避窗口结束前不重启（避免崩溃循环把 CPU 打满）。 */
  private nextStartAllowedAt = 0
  /** 主动关闭标记：避免把正常退出当成崩溃记警告。 */
  private closing = false

  constructor(
    private readonly binaryPath: string,
    private readonly options: { defaultFuel?: number } = {},
  ) {}

  /** 已报告的引擎版本（握手时确定），供审计与诊断。 */
  version(): string {
    return this.engineVersion
  }

  name(): string {
    return 'wasmtime'
  }

  /** 健康探针：握手 + ping。失败返回 ok:false，不抛错（供探针/运维使用）。 */
  async health(): Promise<{ ok: boolean; version?: string; error?: string }> {
    try {
      await this.ensureStarted()
      const pong = await this.request({ t: 'ping' }, HEALTH_TIMEOUT_MS)
      if (pong.t !== 'pong') {
        return { ok: false, error: `非预期应答：${pong.t}` }
      }
      return { ok: true, version: this.engineVersion }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  }

  async run(call: EngineCall): Promise<EngineResult> {
    await this.ensureStarted()
    await this.ensureLoaded(call.key, call.bytes)

    const timeoutMs = call.timeoutMs || DEFAULT_TIMEOUT_MS
    const response = await this.request(
      {
        t: 'call',
        sha256: call.key,
        input: Buffer.from(
          call.input.buffer,
          call.input.byteOffset,
          call.input.byteLength,
        ).toString('base64'),
        rows: call.rows,
        inOff: call.inOff,
        outOff: call.outOff,
        outLength: call.outLength,
        fuel: call.fuel ?? this.options.defaultFuel ?? DEFAULT_FUEL,
        deadlineMs: timeoutMs,
      },
      timeoutMs,
    )

    if (response.t === 'error') {
      // 保留引擎原始原因（FUEL_EXHAUSTED / EPOCH_TIMEOUT / TRAP…）供审计
      throw new WasmEngineFailure(
        response.message ?? 'sidecar 报错',
        response.code ?? 'TRAP',
      )
    }
    const out = Buffer.from(response.out ?? '', 'base64')
    return {
      rc: response.rc ?? -1,
      out: new Int32Array(
        out.buffer,
        out.byteOffset,
        Math.floor(out.byteLength / 4),
      ),
      fuelUsed: response.fuel_used,
    }
  }

  async close(): Promise<void> {
    this.closing = true
    this.loadedKeys.clear()
    this.starting = undefined
    const child = this.child
    this.child = undefined
    if (child) {
      child.kill()
      await new Promise<void>((resolve) => child.once('exit', () => resolve()))
    }
    this.closing = false
  }

  /**
   * 优雅关闭：子进程是常驻的，不接这个钩子的话 `app.close()` 之后进程不会退出
   * （e2e 实测卡住 —— 与 V8 池同一个坑）。
   */
  async onModuleDestroy(): Promise<void> {
    await this.close()
  }

  private async ensureStarted(): Promise<void> {
    if (this.child) return
    if (!this.starting) {
      // 退避窗口内先等一等（崩溃循环保护）
      const wait = this.nextStartAllowedAt - Date.now()
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
      this.starting = this.start().catch((error) => {
        this.starting = undefined
        throw error
      })
    }
    await this.starting
  }

  private async start(): Promise<void> {
    // 二进制缺失要给出**可操作**的错误，而不是 spawn 的 ENOENT
    if (!existsSync(this.binaryPath)) {
      throw new WasmEngineFailure(
        `执行引擎二进制不存在：${this.binaryPath}\n` +
          `构建：cargo build --release -p wasm-host（或设置 ATOMIC_ENGINE_BINARY 指向已有二进制）`,
        'ENGINE_EXIT',
      )
    }
    const child = spawn(this.binaryPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    }) as ChildProcessWithoutNullStreams
    this.child = child
    this.loadedKeys.clear()

    const reader = createInterface({ input: child.stdout })
    reader.on('line', (line) => {
      const trimmed = line.trim()
      if (!trimmed) return
      let message: SidecarMessage
      try {
        message = JSON.parse(trimmed) as SidecarMessage
      } catch {
        // 半截/非法消息视为致命：流已被污染，放弃该进程
        this.crash(new WasmEngineFailure('sidecar 输出非法 JSON', 'BAD_PROTOCOL'))
        return
      }
      if (message.t === 'ready') {
        this.engineVersion = message.wasmtime ?? 'unknown'
        // 握手应答不带 id：按约定的 0 号请求结算（漏掉这一步会让握手永远挂住）
        const handshake = this.pending.get(0)
        if (handshake) {
          clearTimeout(handshake.timer)
          this.pending.delete(0)
          handshake.resolve(message)
        }
        return
      }
      const id = message.id
      if (id === undefined) return
      const pending = this.pending.get(id)
      if (!pending) return
      clearTimeout(pending.timer)
      this.pending.delete(id)
      pending.resolve(message)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      this.logger.debug(`sidecar stderr: ${chunk.toString().trim()}`)
    })
    child.on('exit', (code) => {
      this.crash(
        new WasmEngineFailure(
          `sidecar 退出（code=${code}），在途调用全部失败且不回退`,
          'ENGINE_EXIT',
        ),
      )
    })
    child.on('error', (error) => {
      this.crash(new WasmEngineFailure(`sidecar 启动失败：${error.message}`, 'ENGINE_EXIT'))
    })

    // 握手：协议或引擎版本不匹配 → 拒绝使用该引擎（fail-closed）
    const ready = await this.request(
      { t: 'hello', protocol: PROTOCOL_VERSION },
      STARTUP_TIMEOUT_MS,
      true,
    )
    if (ready.t === 'error') {
      await this.close()
      throw new WasmEngineFailure(
        `引擎握手失败：${ready.code} ${ready.message ?? ''}`,
        'PROTOCOL_MISMATCH',
      )
    }
    // 握手成功：重置退避计数
    this.failures = 0
    this.nextStartAllowedAt = 0
  }

  private async ensureLoaded(key: string, bytes: Uint8Array): Promise<void> {
    if (this.loadedKeys.has(key)) return
    const response = await this.request(
      {
        t: 'load',
        sha256: key,
        bytes: Buffer.from(bytes).toString('base64'),
      },
      STARTUP_TIMEOUT_MS,
    )
    if (response.t === 'error') {
      throw new WasmEngineFailure(
        `引擎拒绝加载模块：${response.code} ${response.message ?? ''}`,
        response.code ?? 'BAD_MODULE',
      )
    }
    this.loadedKeys.add(key)
  }

  private request(
    payload: Record<string, unknown>,
    timeoutMs: number,
    handshake = false,
  ): Promise<SidecarMessage> {
    const child = this.child
    if (!child) {
      return Promise.reject(
        new WasmEngineFailure('sidecar 未启动', 'ENGINE_EXIT'),
      )
    }
    const id = handshake ? 0 : (this.nextId += 1)

    return new Promise<SidecarMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        // 超时说明这个进程可能卡死：终止并让下次调用重建
        this.crash(
          new WasmExecutionTimeout(
            `引擎在 ${timeoutMs}ms 内未应答（进程卡死，已终止，下次调用重建）`,
          ),
        )
        reject(
          new WasmExecutionTimeout(`引擎在 ${timeoutMs}ms 内未应答`),
        )
      }, timeoutMs)

      this.pending.set(id, { resolve, reject, timer })
      child.stdin.write(`${JSON.stringify({ ...payload, id })}\n`, (error) => {
        if (!error) return
        const pending = this.pending.get(id)
        this.pending.delete(id)
        if (pending) clearTimeout(pending.timer)
        reject(new WasmEngineFailure(`写入引擎失败：${error.message}`, 'ENGINE_EXIT'))
      })
    })
  }

  /** 进程异常：在途调用全部失败（不回退），并按退避安排重启。 */
  private crash(error: Error): void {
    const child = this.child
    if (this.closing) {
      // 主动关闭导致的退出：不记崩溃、不排退避
      this.child = undefined
      return
    }
    this.child = undefined
    this.starting = undefined
    this.loadedKeys.clear()
    child?.kill()

    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      this.pending.delete(id)
      pending.reject(error)
    }
    // 真实退避：指数增长、封顶；重启是**惰性**的 —— 下一次调用先等过退避窗口再拉起进程
    this.failures += 1
    const backoff = Math.min(
      RESTART_BACKOFF_MS * 2 ** (this.failures - 1),
      MAX_BACKOFF_MS,
    )
    this.nextStartAllowedAt = Date.now() + backoff
    this.logger.warn(
      `引擎进程异常（第 ${this.failures} 次）：${error.message}；${backoff}ms 后允许重启`,
    )
  }
}
