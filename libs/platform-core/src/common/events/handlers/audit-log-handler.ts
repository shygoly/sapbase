import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { IEventHandler } from '../i-event-handler'
import { AuditLog } from '../../../audit-logs/audit-log.entity'

/**
 * Example event handler: Logs all domain events to audit log.
 * This demonstrates how to subscribe to events across modules.
 */
@Injectable()
export class AuditLogEventHandler implements IEventHandler<any> {
  private readonly logger = new Logger(AuditLogEventHandler.name)

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async handle(event: any): Promise<void> {
    try {
      const eventName = event.constructor?.name || 'UnknownEvent'
      const organizationId = this.extractOrganizationId(event)

      // Only log if organizationId is available
      if (organizationId) {
        await this.auditLogRepository.save({
          action: `event:${eventName}`,
          resource: 'Event',
          actor: 'system',
          status: 'success' as const,
          resourceId: this.extractEntityId(event) || undefined,
          metadata: {
            eventName,
            eventData: this.sanitizeEventData(event),
          },
          organizationId,
        } as any)
      }
    } catch (error) {
      // Don't throw - audit logging failures shouldn't break event processing
      this.logger.warn(`Failed to log event to audit log: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private extractOrganizationId(event: any): string | null {
    return event.organizationId || event.instance?.organizationId || null
  }

  private extractEntityId(event: any): string | null {
    return event.moduleId || event.instanceId || event.organizationId || event.userId || null
  }

  /**
   * 敏感字段清单。
   *
   * 用**清单**而不是正则/猜测：审计是"事后唯一能还原发生过什么"的地方，
   * 它既不能漏（漏一个就是明文落库），也不该误删（删多了就还原不出事实）。
   *
   * 2026-09-25 补入 `password` / `secret` / `authorization`：原清单只有
   * `passwordHash` / `apiKey` / `token`，于是事件里带 `password` 会**明文写进审计** ——
   * 这是 spec 早就断言、实现却没做到的一处（change: restore-green-backend-tests）。
   */
  private static readonly SENSITIVE_KEYS = new Set([
    'password',
    'passwordHash',
    'apiKey',
    'token',
    'secret',
    'authorization',
  ])

  private sanitizeEventData(event: unknown): Record<string, any> {
    return AuditLogEventHandler.sanitize(event) as Record<string, any>
  }

  /**
   * 递归剔除敏感键。
   *
   * 为什么要递归：事件载荷通常是 `{ type, data: { password } }` —— 只过滤顶层键的话，
   * **嵌套的 `data.password` 会明文写进审计**。这正是本条 spec 一直断言、
   * 而实现从未做到的那件事（change: restore-green-backend-tests）。
   *
   * 命中即整键剔除（而不是替换成 `[REDACTED]`）：审计里连键名都不该出现。
   * 数组保持数组形状，避免把载荷结构改得看不出原样。
   */
  private static sanitize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => AuditLogEventHandler.sanitize(item))
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {}
      for (const [key, nested] of Object.entries(value)) {
        if (AuditLogEventHandler.SENSITIVE_KEYS.has(key)) continue
        out[key] = AuditLogEventHandler.sanitize(nested)
      }
      return out
    }
    return value
  }
}
