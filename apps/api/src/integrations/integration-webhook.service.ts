import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { createHash } from 'node:crypto'
import { DataSource, Repository } from 'typeorm'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import { OutboxService } from '../outbox/outbox.service'
import {
  WebhookEndpoint,
  WebhookEvent,
  type WebhookEventStatus,
} from './integrations.entities'
import {
  resolveSecret,
  verifyWebhookSignature,
  IntegrationSecurityError,
} from './integrations.security'
import type { IntegrationActor } from './integration-connector.service'

export interface WebhookHeaders {
  signature?: string
  timestamp?: string
  eventId?: string
  eventType?: string
}

@Injectable()
export class IntegrationWebhookService {
  constructor(
    @InjectRepository(WebhookEndpoint)
    private readonly endpoints: Repository<WebhookEndpoint>,
    @InjectRepository(WebhookEvent)
    private readonly events: Repository<WebhookEvent>,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async listEndpoints(organizationId: string) {
    return this.endpoints.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    })
  }

  async createEndpoint(
    organizationId: string,
    actor: IntegrationActor,
    input: {
      key: string
      name: string
      secretRef: string
      eventType?: string
      mapping?: Record<string, unknown>
      allowedIps?: string[]
    },
  ) {
    if (!input.key || !input.name || !input.secretRef) {
      throw new BadRequestException('key/name/secretRef 必填')
    }
    resolveSecret(input.secretRef)
    const existing = await this.endpoints.findOne({
      where: { organizationId, key: input.key },
    })
    if (existing) throw new ConflictException(`webhook key 已存在：${input.key}`)
    const row = await this.endpoints.save(
      this.endpoints.create({
        organizationId,
        key: input.key,
        name: input.name,
        secretRef: input.secretRef,
        eventType: input.eventType ?? '*',
        mapping: input.mapping ?? {},
        allowedIps: input.allowedIps ?? [],
        status: 'active',
        createdBy: actor.id,
      }),
    )
    await this.audit(organizationId, actor.id, 'webhook.endpoint.created', row.id, {
      key: row.key,
    })
    return { ...row, secretRef: `secret:${row.secretRef}` }
  }

  async disableEndpoint(organizationId: string, actor: IntegrationActor, id: string) {
    const row = await this.endpoints.findOne({ where: { id, organizationId } })
    if (!row) throw new NotFoundException('Webhook 端点不存在')
    row.status = 'disabled'
    await this.endpoints.save(row)
    await this.audit(organizationId, actor.id, 'webhook.endpoint.disabled', row.id, {
      key: row.key,
    })
    return row
  }

  async listEvents(organizationId: string, status?: WebhookEventStatus) {
    return this.events.find({
      where: { organizationId, ...(status ? { status } : {}) },
      order: { receivedAt: 'DESC' },
      take: 200,
    })
  }

  async receive(
    organizationId: string,
    key: string,
    headers: WebhookHeaders,
    rawBody: Buffer,
    ip?: string,
  ): Promise<{ eventId: string; duplicate: boolean; status: string }> {
    if (rawBody.length > 1024 * 1024) {
      throw new BadRequestException('Webhook payload 超过 1MB')
    }
    const endpoint = await this.endpoints.findOne({
      where: { organizationId, key, status: 'active' },
    })
    if (!endpoint) throw new NotFoundException('Webhook 端点不存在或已停用')
    if (endpoint.allowedIps.length > 0) {
      const allowed = endpoint.allowedIps.some((entry) =>
        entry === '*' ? true : entry.endsWith('*') ? (ip ?? '').startsWith(entry.slice(0, -1)) : entry === ip,
      )
      if (!allowed) throw new ForbiddenException('来源 IP 不在白名单')
    }
    const signature = headers.signature
    const timestamp = headers.timestamp
    const eventId = headers.eventId
    if (!signature || !timestamp || !eventId) {
      throw new BadRequestException('缺少 x-signature/x-timestamp/x-event-id')
    }
    let bodyText: string
    try {
      bodyText = rawBody.toString('utf8')
      verifyWebhookSignature(
        resolveSecret(endpoint.secretRef),
        timestamp,
        bodyText,
        signature,
      )
    } catch (error) {
      await this.audit(organizationId, 'system:webhook', 'webhook.security.rejected', endpoint.id, {
        key,
        reason: (error as Error).message,
      })
      if (error instanceof IntegrationSecurityError) {
        throw new ForbiddenException(error.message)
      }
      throw error
    }
    let payload: Record<string, unknown>
    try {
      const parsed = JSON.parse(bodyText)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('payload 必须是对象')
      }
      payload = parsed as Record<string, unknown>
    } catch (error) {
      throw new BadRequestException(`Webhook JSON 非法：${(error as Error).message}`)
    }
    const payloadHash = createHash('sha256').update(rawBody).digest('hex')
    const existing = await this.events.findOne({
      where: { endpointId: endpoint.id, eventId },
    })
    if (existing) {
      return { eventId, duplicate: true, status: existing.status }
    }
    let event: WebhookEvent
    try {
      event = await this.events.save(
        this.events.create({
          organizationId,
          endpointId: endpoint.id,
          eventId,
          payloadHash,
          payload,
          status: 'received',
          error: null,
          receivedAt: new Date(),
          processedAt: null,
        }),
      )
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        return { eventId, duplicate: true, status: 'duplicate' }
      }
      throw error
    }
    try {
      const topic =
        typeof endpoint.mapping.topic === 'string'
          ? endpoint.mapping.topic
          : `integration.webhook.${endpoint.key}`
      await this.dataSource.transaction(async (manager) => {
        await this.outbox.publish(manager, {
          topic,
          organizationId,
          idempotencyKey: `webhook:${endpoint.id}:${eventId}`,
          payload: {
            eventId,
            eventType: headers.eventType ?? endpoint.eventType,
            endpointKey: endpoint.key,
            data: payload,
          },
          aggregateType: 'webhook_event',
          aggregateId: event.id,
        })
      })
      event.status = 'processed'
      event.processedAt = new Date()
      await this.events.save(event)
      await this.audit(organizationId, 'system:webhook', 'webhook.received', event.id, {
        key,
        eventId,
        topic,
      })
      return { eventId, duplicate: false, status: 'processed' }
    } catch (error) {
      event.status = 'failed'
      event.error = (error as Error).message
      await this.events.save(event)
      await this.audit(organizationId, 'system:webhook', 'webhook.failed', event.id, {
        key,
        eventId,
        error: event.error,
      })
      throw error
    }
  }

  async replay(organizationId: string, actor: IntegrationActor, id: string) {
    const event = await this.events.findOne({ where: { id, organizationId } })
    if (!event) throw new NotFoundException('Webhook 事件不存在')
    if (!['failed', 'dead', 'received'].includes(event.status)) {
      throw new ConflictException(`事件状态 ${event.status} 不可重放`)
    }
    const endpoint = await this.endpoints.findOne({ where: { id: event.endpointId } })
    if (!endpoint) throw new NotFoundException('Webhook 端点不存在')
    const topic =
      typeof endpoint.mapping.topic === 'string'
        ? endpoint.mapping.topic
        : `integration.webhook.${endpoint.key}`
    await this.dataSource.transaction(async (manager) => {
      await this.outbox.publish(manager, {
        topic,
        organizationId,
        idempotencyKey: `webhook:${endpoint.id}:${event.eventId}:replay:${Date.now()}`,
        payload: {
          eventId: event.eventId,
          eventType: endpoint.eventType,
          endpointKey: endpoint.key,
          data: event.payload,
          replay: true,
        },
        aggregateType: 'webhook_event',
        aggregateId: event.id,
      })
    })
    event.status = 'processed'
    event.error = null
    event.processedAt = new Date()
    await this.events.save(event)
    await this.audit(organizationId, actor.id, 'webhook.replayed', event.id, {
      eventId: event.eventId,
    })
    return event
  }

  private async audit(
    organizationId: string,
    actor: string,
    action: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.auditLogs.create({
      organizationId,
      action,
      resource: 'connector',
      resourceId,
      actor,
      status: action.includes('rejected') || action.includes('failed') ? 'failure' : 'success',
      metadata,
      source: 'integration',
    })
  }
}
