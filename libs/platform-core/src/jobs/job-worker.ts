import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { hostname } from 'node:os'
import { randomUUID } from 'node:crypto'
import {
  isJobLeaseExpired,
  nextRetryDelayMs,
  shouldRetryJob,
  type JobBackoff,
} from './job-state'
import { JobQueue } from './job-queue'
import { JobTypeRegistry } from './job-types'
import type { JobContext, JobRecord, JobResult } from './job-types'

export interface JobWorkerOptions {
  workerId?: string
  leaseMs?: number
  heartbeatMs?: number
  pollMs?: number
  /** 单次 tick 最多领取多少个。 */
  batchSize?: number
  /** 是否随 Nest 模块启动；测试/API-only 进程可关。 */
  autoStart?: boolean
}

const DEFAULT_LEASE_MS = 30_000
const DEFAULT_HEARTBEAT_MS = 10_000
const DEFAULT_POLL_MS = 1_000
const DEFAULT_BATCH_SIZE = 5
const DEFAULT_BACKOFF: JobBackoff = {
  kind: 'exponential',
  baseMs: 5_000,
  maxMs: 5 * 60_000,
}

export class JobTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`任务执行超时（${timeoutMs}ms）`)
    this.name = 'JobTimeoutError'
  }
}

/**
 * Worker：领取 → 执行 → 记录 → 完成/重试/DLQ。
 *
 * v1 是单进程轮询 + lease；Redis 唤醒是可选的加速，不改变 PG 真源。
 * 优雅停机只停止领取，已领取任务会跑完或由 lease 超时回收。
 */
@Injectable()
export class JobWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly workerId: string
  private readonly leaseMs: number
  private readonly heartbeatMs: number
  private readonly pollMs: number
  private readonly batchSize: number
  private readonly autoStart: boolean
  private timer: NodeJS.Timeout | null = null
  private running = false
  private ticking = false
  private readonly inFlight = new Set<Promise<void>>()

  constructor(
    private readonly queue: JobQueue,
    private readonly registry: JobTypeRegistry,
  ) {
    this.workerId =
      process.env.JOBS_WORKER_ID ?? `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`
    this.leaseMs = Number(process.env.JOBS_LEASE_MS ?? DEFAULT_LEASE_MS)
    this.heartbeatMs = Number(process.env.JOBS_HEARTBEAT_MS ?? DEFAULT_HEARTBEAT_MS)
    this.pollMs = Number(process.env.JOBS_POLL_MS ?? DEFAULT_POLL_MS)
    this.batchSize = Number(process.env.JOBS_BATCH_SIZE ?? DEFAULT_BATCH_SIZE)
    this.autoStart = process.env.JOBS_WORKER_ENABLED === 'true'
  }

  onModuleInit(): void {
    if (this.autoStart) this.start()
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop()
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.timer = setInterval(() => {
      void this.tick()
    }, this.pollMs)
  }

  async stop(): Promise<void> {
    this.running = false
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    await Promise.allSettled([...this.inFlight])
  }

  /** 手动 tick：测试与“Redis 唤醒”都走这里。 */
  async tick(): Promise<number> {
    if (this.ticking) return 0
    this.ticking = true
    try {
      await this.queue.reclaimExpired()
      let claimed = 0
      for (let index = 0; index < this.batchSize; index++) {
        const job = await this.queue.claim(this.workerId, this.leaseMs, this.concurrencyMap())
        if (!job) break
        claimed += 1
        const task = this.run(job)
        this.inFlight.add(task)
        void task.catch(() => undefined).finally(() => this.inFlight.delete(task))
        // 测试/单进程下顺序执行更可预测；生产可改成不 await。
        await task
      }
      return claimed
    } finally {
      this.ticking = false
    }
  }

  /** 直接执行一个已领取的任务（测试用）。 */
  async run(job: JobRecord): Promise<void> {
    const startedAt = new Date()
    const controller = new AbortController()
    let heartbeat: NodeJS.Timeout | null = null
    let timedOut = false

    const definition = (() => {
      try {
        return this.registry.get(job.type, job.typeVersion)
      } catch {
        return null
      }
    })()

    if (!definition) {
      await this.queue.recordAttempt({
        jobId: job.id,
        attempt: job.attempts,
        status: 'failed',
        startedAt,
        finishedAt: new Date(),
        error: { message: `未知任务类型 ${job.type}@${job.typeVersion}` },
      })
      await this.queue.fail(job.id, this.workerId, {
        message: `未知任务类型 ${job.type}@${job.typeVersion}`,
        reason: 'unknown-type',
      })
      return
    }

    await this.queue.recordAttempt({
      jobId: job.id,
      attempt: job.attempts,
      status: 'running',
      startedAt,
    })

    heartbeat = setInterval(() => {
      void this.queue.heartbeat(job.id, this.workerId, this.leaseMs)
    }, this.heartbeatMs)
    heartbeat.unref?.()

    const ctx: JobContext = {
      jobId: job.id,
      organizationId: job.organizationId,
      type: job.type,
      typeVersion: job.typeVersion,
      attempt: job.attempts,
      signal: controller.signal,
      isCancelled: () => this.queue.isCancelRequested(job.id),
      progress: async (progress, payload) => {
        await this.queue.progress(job.id, progress)
        await this.queue.appendEvent(job.id, 'progress', { progress, ...(payload ?? {}) })
      },
      stage: async (stage, payload) => {
        await this.queue.appendEvent(job.id, 'stage', { stage, ...(payload ?? {}) })
      },
      log: async (message, payload) => {
        await this.queue.appendEvent(job.id, 'log', { message, ...(payload ?? {}) })
      },
    }

    try {
      if (await this.queue.isCancelRequested(job.id)) {
        controller.abort()
        await this.queue.cancelRunning(job.id, this.workerId)
        await this.queue.recordAttempt({
          jobId: job.id,
          attempt: job.attempts,
          status: 'cancelled',
          startedAt,
          finishedAt: new Date(),
        })
        return
      }

      const timeoutMs = definition.timeoutMs ?? 60_000
      const result = await this.withTimeout(
        Promise.resolve(definition.handler(ctx, job.payload)),
        timeoutMs,
        () => {
          timedOut = true
          controller.abort()
        },
      )

      if (await this.queue.isCancelRequested(job.id)) {
        controller.abort()
        await this.queue.cancelRunning(job.id, this.workerId)
        await this.queue.recordAttempt({
          jobId: job.id,
          attempt: job.attempts,
          status: 'cancelled',
          startedAt,
          finishedAt: new Date(),
        })
        return
      }

      const normalized = normalizeResult(result)
      await this.queue.complete(job.id, this.workerId, normalized.result)
      await this.queue.recordAttempt({
        jobId: job.id,
        attempt: job.attempts,
        status: 'succeeded',
        startedAt,
        finishedAt: new Date(),
      })
      await this.queue.appendEvent(job.id, 'stage', { stage: 'succeeded' })
    } catch (error) {
      controller.abort()
      const message = error instanceof Error ? error.message : String(error)
      const errorPayload = {
        message,
        name: error instanceof Error ? error.name : 'Error',
        timeout: timedOut || error instanceof JobTimeoutError,
      }
      const retry = !timedOut && shouldRetryJob(job.attempts, job.maxAttempts)
      // 超时也允许重试：超时算一次失败。
      const shouldRetry = timedOut
        ? shouldRetryJob(job.attempts, job.maxAttempts)
        : retry
      const delay = nextRetryDelayMs(
        job.attempts,
        definition.backoff ?? DEFAULT_BACKOFF,
      )
      await this.queue.fail(
        job.id,
        this.workerId,
        errorPayload,
        shouldRetry
          ? { status: 'queued', runAt: new Date(Date.now() + delay) }
          : { status: 'dead' },
      )
      await this.queue.recordAttempt({
        jobId: job.id,
        attempt: job.attempts,
        status: timedOut ? 'timeout' : 'failed',
        startedAt,
        finishedAt: new Date(),
        error: errorPayload,
      })
      await this.queue.appendEvent(job.id, 'error', errorPayload)
    } finally {
      if (heartbeat) clearInterval(heartbeat)
    }
  }

  private concurrencyMap(): Record<string, number> {
    const map: Record<string, number> = {}
    for (const definition of this.registry.list()) {
      map[definition.type] = definition.concurrency ?? 1
    }
    return map
  }

  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    onTimeout: () => void,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        onTimeout()
        reject(new JobTimeoutError(timeoutMs))
      }, timeoutMs)
      timer.unref?.()
      promise.then(
        (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        (error) => {
          clearTimeout(timer)
          reject(error)
        },
      )
    })
  }

  /** 供测试/管理面：判断过期（纯函数导出也保留）。 */
  isLeaseExpired(job: JobRecord, now = new Date()): boolean {
    return isJobLeaseExpired(job.leaseUntil, now)
  }
}

function normalizeResult(value: JobResult | void | undefined): {
  result: Record<string, unknown> | null
} {
  if (!value) return { result: null }
  if (typeof value !== 'object') return { result: null }
  const result = (value as JobResult).result
  if (result === undefined || result === null) return { result: null }
  if (typeof result === 'object' && !Array.isArray(result)) {
    return { result: result as Record<string, unknown> }
  }
  return { result: { value: result } }
}
