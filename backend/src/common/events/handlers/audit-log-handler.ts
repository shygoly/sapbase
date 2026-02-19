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

  private sanitizeEventData(event: any): Record<string, any> {
    const data: Record<string, any> = {}
    for (const [key, value] of Object.entries(event)) {
      // Exclude sensitive fields
      if (key !== 'passwordHash' && key !== 'apiKey' && key !== 'token') {
        data[key] = value
      }
    }
    return data
  }
}
