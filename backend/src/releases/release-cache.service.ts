import { Injectable } from '@nestjs/common'
import { createClient } from 'redis'

@Injectable()
export class ReleaseCacheService {
  private client: ReturnType<typeof createClient> | null = null

  private async ensureClient() {
    const url = process.env.RELEASE_REDIS_URL ?? process.env.REDIS_URL
    if (!url) return null
    if (this.client?.isOpen) return this.client
    try {
      const client = createClient({ url })
      client.on('error', () => undefined)
      await client.connect()
      this.client = client
    } catch {
      this.client = null
    }
    return this.client
  }

  async bumpActiveVersion(organizationId: string, appKey: string): Promise<void> {
    const client = await this.ensureClient()
    if (!client) return
    await client.incr(`sap:${process.env.NODE_ENV ?? 'dev'}:${organizationId}:cache:release:active:${appKey}`)
  }
}
