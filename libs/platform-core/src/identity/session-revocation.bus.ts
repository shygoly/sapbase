import { Injectable } from '@nestjs/common'

export const SESSION_REVOCATION_BUS = Symbol('SESSION_REVOCATION_BUS')

export interface SessionRevocationEvent {
  sid?: string
  userId?: string
  organizationId?: string
  reason: string
}

export interface SessionRevocationBus {
  publish(event: SessionRevocationEvent): void
  subscribe(handler: (event: SessionRevocationEvent) => void): () => void
}

/**
 * 单实例内同步通知 WebSocket 断开。
 *
 * 多实例部署时由 Redis pub/sub 适配器替换同一接口；会话缓存本身走
 * cache-manager（生产 Redis），吊销仍以 DB 为真源。
 */
@Injectable()
export class InMemorySessionRevocationBus implements SessionRevocationBus {
  private readonly handlers = new Set<(event: SessionRevocationEvent) => void>()

  publish(event: SessionRevocationEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event)
      } catch {
        // 断开失败不影响吊销真源；下次请求仍会被 JWT 守卫拒绝。
      }
    }
  }

  subscribe(handler: (event: SessionRevocationEvent) => void): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }
}
