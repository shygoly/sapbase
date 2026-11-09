import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { createClient } from 'redis'

@Injectable()
export class ReleaseIdempotencyService implements OnModuleDestroy {
  private readonly logger = new Logger(ReleaseIdempotencyService.name)
  private readonly memory = new Map<string, { value: unknown; expiresAt: number }>()
  private client: ReturnType<typeof createClient> | null = null
  private connecting: Promise<void> | null = null

  private async ensureClient(): Promise<ReturnType<typeof createClient> | null> {
    const url = process.env.RELEASE_REDIS_URL ?? process.env.REDIS_URL
    if (!url) return null
    if (this.client?.isOpen) return this.client
    if (!this.connecting) {
      this.connecting = (async () => {
        try {
          const client = createClient({ url })
          client.on('error', (error) => this.logger.warn(`redis idempotency error: ${error.message}`))
          await client.connect()
          this.client = client
        } catch (error) {
          this.logger.warn(`redis idempotency unavailable, falling back to memory: ${(error as Error).message}`)
          this.client = null
        } finally {
          this.connecting = null
        }
      })()
    }
    await this.connecting
    return this.client
  }

  private keyOf(key: string): string {
    return `sap:${process.env.NODE_ENV ?? 'dev'}:idem:${key}`
  }

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const redis = await this.ensureClient()
    const redisKey = this.keyOf(key)
    if (redis) {
      const cached = await redis.get(redisKey)
      if (cached) {
        try {
          return (JSON.parse(cached) as { value: T }).value
        } catch {
          await redis.del(redisKey)
        }
      }
      const result = await fn()
      const ttl = Number(process.env.RELEASE_IDEMPOTENCY_TTL_SECONDS ?? 86400)
      await redis.set(redisKey, JSON.stringify({ value: result }), { EX: ttl })
      return result
    }

    const now = Date.now()
    const cached = this.memory.get(key)
    if (cached && cached.expiresAt > now) return cached.value as T
    if (cached) this.memory.delete(key)
    const result = await fn()
    const ttl = Number(process.env.RELEASE_IDEMPOTENCY_TTL_SECONDS ?? 86400)
    this.memory.set(key, { value: result, expiresAt: now + ttl * 1000 })
    return result
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) await this.client.quit()
  }
}
