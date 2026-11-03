import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { createClient } from 'redis'

@Injectable()
export class AgentSessionCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(AgentSessionCacheService.name)
  private readonly memory = new Map<string, string>()
  private client: ReturnType<typeof createClient> | null = null
  private connecting: Promise<void> | null = null

  private async ensureClient(): Promise<ReturnType<typeof createClient> | null> {
    const url = process.env.AGENT_REDIS_URL ?? process.env.REDIS_URL
    if (!url) return null
    if (this.client?.isOpen) return this.client
    if (!this.connecting) {
      this.connecting = (async () => {
        try {
          const client = createClient({ url })
          client.on('error', (error) => this.logger.warn(`redis error: ${error.message}`))
          await client.connect()
          this.client = client
        } catch (error) {
          this.logger.warn(`redis unavailable, using memory cache: ${(error as Error).message}`)
          this.client = null
        } finally {
          this.connecting = null
        }
      })()
    }
    await this.connecting
    return this.client
  }

  async remember(conversationId: string, value: unknown): Promise<void> {
    const payload = JSON.stringify(value)
    const client = await this.ensureClient()
    if (client) {
      await client.set(`sap:agent:conversation:${conversationId}`, payload, { EX: 7 * 24 * 60 * 60 })
      return
    }
    this.memory.set(conversationId, payload)
  }

  async recent<T>(conversationId: string): Promise<T | null> {
    const client = await this.ensureClient()
    const payload = client
      ? await client.get(`sap:agent:conversation:${conversationId}`)
      : this.memory.get(conversationId)
    return payload ? (JSON.parse(payload) as T) : null
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) await this.client.quit()
  }
}
