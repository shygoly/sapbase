import { Injectable, type OnModuleDestroy } from '@nestjs/common'

const CHANNEL = 'sapbase:jobs:new'

type RedisClient = {
  connect(): Promise<void>
  publish(channel: string, message: string): Promise<number>
  subscribe(channel: string, listener: (message: string) => void): Promise<void>
  quit(): Promise<void>
}

/**
 * Redis 唤醒（可选）。
 *
 * PG 仍是真源；这里只做“有新任务”的加速信号，订阅失败/Redis 不可用时
 * worker 的 interval poll 仍会兜底。因此没有 Redis 不是错误，只是慢一点。
 */
@Injectable()
export class JobWakeupService implements OnModuleDestroy {
  private publisher: RedisClient | null = null
  private subscriber: RedisClient | null = null
  private enabled = false
  private connecting: Promise<void> | null = null

  constructor() {
    this.enabled = Boolean(
      process.env.JOBS_WAKEUP_REDIS_URL ||
        process.env.REDIS_URL ||
        process.env.REDIS_HOST,
    )
  }

  get isEnabled(): boolean {
    return this.enabled
  }

  async publish(jobId: string): Promise<void> {
    if (!this.enabled) return
    try {
      const client = await this.ensurePublisher()
      await client?.publish(CHANNEL, jobId)
    } catch {
      // 唤醒失败不影响入队；poll 会补上。
    }
  }

  async subscribe(handler: (jobId: string) => void): Promise<void> {
    if (!this.enabled || this.subscriber) return
    try {
      const client = this.createClient()
      if (!client) return
      this.subscriber = client
      await client.connect()
      await client.subscribe(CHANNEL, handler)
    } catch {
      this.subscriber = null
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.publisher?.quit(),
      this.subscriber?.quit(),
    ])
    this.publisher = null
    this.subscriber = null
  }

  private async ensurePublisher(): Promise<RedisClient | null> {
    if (this.publisher) return this.publisher
    if (this.connecting) {
      await this.connecting
      return this.publisher
    }
    const client = this.createClient()
    if (!client) {
      this.enabled = false
      return null
    }
    this.connecting = client.connect().then(() => {
      this.publisher = client
    })
    try {
      await this.connecting
    } finally {
      this.connecting = null
    }
    return this.publisher
  }

  private createClient(): RedisClient | null {
    try {
      // 动态加载：没有 redis 依赖时自动退化为 poll，不让模块启动失败。
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const redis = require('redis') as {
        createClient: (options: Record<string, unknown>) => RedisClient
      }
      const url =
        process.env.JOBS_WAKEUP_REDIS_URL ||
        process.env.REDIS_URL ||
        undefined
      const host = process.env.REDIS_HOST || 'localhost'
      const port = Number(process.env.REDIS_PORT ?? 6379)
      return url
        ? redis.createClient({ url })
        : redis.createClient({ socket: { host, port } })
    } catch {
      return null
    }
  }
}
