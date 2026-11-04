import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { Worker } from 'node:worker_threads'
import {
  type EngineCall,
  type EngineResult,
  type WasmEngine,
  WasmEngineFailure,
  WasmExecutionTimeout,
} from './wasm-engine'

const INITIAL_PAGES = 2 // 与 ABI v1 的 --initial-memory=131072 对应
const MAX_PAGES = 1024 // 与 ABI v1 的 --max-memory=67108864 对应

/**
 * 常驻 Worker：**编译一次模块，每次调用重建实例与内存**。
 *
 * 为什么这么切分（依据 2026-09-25 压测）：
 *   · rows=2 → mean 40.5ms；rows=20000 → mean 46.0ms。**成本几乎全在固定开销**
 *     （Worker 启停 + 模块编译），计算量本身只占约 5ms。
 *   · 所以缓存"Worker + 已编译模块"，但**每次调用新建内存与实例** ——
 *     语义与"每次全新沙箱"一致（模块全局状态不跨调用残留），只省掉进程与编译。
 *
 * 超时语义不变：一次调用超时 → **终止该 Worker 并把它从池里摘掉**
 * （死循环的 Worker 不可复用），该次调用抛 `WasmExecutionTimeout`。
 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads')
let compiled
try {
  compiled = new WebAssembly.Module(new Uint8Array(workerData.bytes))
} catch (error) {
  parentPort.postMessage({ fatal: String((error && error.message) || error) })
  throw error
}
parentPort.on('message', (msg) => {
  try {
    const memory = new WebAssembly.Memory({
      initial: workerData.initialPages,
      maximum: workerData.maxPages,
    })
    const instance = new WebAssembly.Instance(compiled, { env: { memory } })
    const needed = msg.outOff + msg.outLength * 4
    if (needed > memory.buffer.byteLength) {
      memory.grow(Math.ceil(needed / 65536) - memory.buffer.byteLength / 65536)
    }
    if (msg.input.length > 0) {
      new Int32Array(memory.buffer, msg.inOff, msg.input.length).set(msg.input)
    }
    const rc = instance.exports.run(msg.inOff, msg.rows, msg.outOff)
    const out = new Int32Array(memory.buffer, msg.outOff, msg.outLength)
    parentPort.postMessage({ id: msg.id, rc, out: Array.from(out) })
  } catch (error) {
    parentPort.postMessage({ id: msg.id, error: String((error && error.message) || error) })
  }
})
`

/** 与引擎接缝对齐的类型别名（历史命名保留，避免无谓改名）。 */
export type PoolCall = EngineCall
export type PoolResult = EngineResult
export { WasmExecutionTimeout, WasmEngineFailure }

interface PooledWorker {
  worker: Worker
  /** 串行化：同一 Worker 一次只处理一个调用（WebAssembly 实例不是线程安全的复用对象）。 */
  tail: Promise<unknown>
}

@Injectable()
export class WasmInstancePool implements OnModuleDestroy {
  private readonly workers = new Map<string, PooledWorker>()
  private requestId = 0

  async run(call: PoolCall): Promise<PoolResult> {
    const pooled = this.acquire(call.key, call.bytes)
    const current = pooled.tail
      .catch(() => undefined)
      .then(() => this.dispatch(pooled, call))
    pooled.tail = current.catch(() => undefined)
    return current
  }

  name(): string {
    return 'v8'
  }

  /** 关闭全部 Worker（应用关闭 / 测试收尾）。 */
  async close(): Promise<void> {
    const workers = [...this.workers.values()]
    this.workers.clear()
    await Promise.all(workers.map((pooled) => pooled.worker.terminate()))
  }

  /**
   * 优雅关闭：常驻 Worker 会让事件循环保持活跃，
   * 不接生命周期钩子的话 `app.close()` 之后进程不会退出（e2e 实测卡住）。
   */
  async onModuleDestroy(): Promise<void> {
    await this.close()
  }

  /** 仅供测试与排查：当前常驻的模块数。 */
  size(): number {
    return this.workers.size
  }

  private acquire(key: string, bytes: Uint8Array): PooledWorker {
    const existing = this.workers.get(key)
    if (existing) return existing

    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { bytes, initialPages: INITIAL_PAGES, maxPages: MAX_PAGES },
    })
    const pooled: PooledWorker = { worker, tail: Promise.resolve() }
    this.workers.set(key, pooled)
    return pooled
  }

  private dispatch(pooled: PooledWorker, call: PoolCall): Promise<PoolResult> {
    const id = (this.requestId += 1)
    const worker = pooled.worker

    return new Promise<PoolResult>((resolve, reject) => {
      let settled = false

      const succeed = (finish: () => void) => {
        if (settled) return
        settled = true
        worker.off('message', onMessage)
        worker.off('error', onError)
        clearTimeout(timer)
        finish()
      }

      /** 不可复用的失败：摘掉 Worker 再拒绝。 */
      const abandon = (finish: () => void) => {
        if (settled) return
        settled = true
        worker.off('message', onMessage)
        worker.off('error', onError)
        clearTimeout(timer)
        this.workers.delete(call.key)
        void worker.terminate()
        finish()
      }

      const onMessage = (message: {
        id?: number
        rc?: number
        out?: number[]
        error?: string
        fatal?: string
      }) => {
        if (message.fatal) {
          abandon(() => reject(new WasmEngineFailure(message.fatal as string)))
          return
        }
        if (message.id !== id) return
        if (message.error) {
          // 模块自身抛错：Worker 仍可复用（每次调用都是新实例）
          succeed(() => reject(new WasmEngineFailure(message.error as string)))
          return
        }
        succeed(() =>
          resolve({
            rc: message.rc ?? -1,
            out: Int32Array.from(message.out ?? []),
          }),
        )
      }

      const onError = (error: Error) => {
        abandon(() => reject(new WasmEngineFailure(error.message)))
      }

      const timer = setTimeout(() => {
        abandon(() =>
          reject(new WasmExecutionTimeout(`执行超过 ${call.timeoutMs}ms 被终止`)),
        )
      }, call.timeoutMs)

      worker.on('message', onMessage)
      worker.on('error', onError)
      worker.postMessage({
        id,
        input: call.input,
        rows: call.rows,
        inOff: call.inOff,
        outOff: call.outOff,
        outLength: call.outLength,
      })
    })
  }
}
