import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import { JobsService } from '@sap/platform-core/jobs/jobs.service'
import {
  IntegrationConnector,
  OutboundMessage,
  type OutboundStatus,
} from './integrations.entities'
import { IntegrationConnectorService, type IntegrationActor } from './integration-connector.service'
import {
  assertSafeOutboundUrl,
  assertResolvedHostSafe,
  redact,
  truncateBody,
} from './integrations.security'

export interface EnqueueOutboundInput {
  connectorId: string
  eventType: string
  payload: Record<string, unknown>
  idempotencyKey: string
}

@Injectable()
export class IntegrationOutboundService {
  private readonly circuit = new Map<string, { failures: number; openUntil: number }>()
  private readonly rate = new Map<string, number[]>()

  constructor(
    @InjectRepository(OutboundMessage)
    private readonly messages: Repository<OutboundMessage>,
    @InjectRepository(IntegrationConnector)
    private readonly connectors: Repository<IntegrationConnector>,
    private readonly connectorService: IntegrationConnectorService,
    private readonly jobs: JobsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async enqueue(
    organizationId: string,
    actor: IntegrationActor,
    input: EnqueueOutboundInput,
  ): Promise<OutboundMessage> {
    if (!input.connectorId || !input.eventType || !input.idempotencyKey) {
      throw new BadRequestException('connectorId/eventType/idempotencyKey 必填')
    }
    const connector = await this.connectorService.get(organizationId, input.connectorId)
    if (connector.status !== 'active') {
      throw new ForbiddenException(`连接器状态 ${connector.status} 不可调用`)
    }
    const existing = await this.messages.findOne({
      where: { organizationId, idempotencyKey: input.idempotencyKey },
    })
    if (existing) return existing
    const message = await this.messages.save(
      this.messages.create({
        organizationId,
        connectorId: connector.id,
        eventType: input.eventType,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
        status: 'queued',
        attempts: 0,
        maxAttempts: Number(connector.config.maxAttempts ?? 5),
        createdBy: actor.id,
      }),
    )
    await this.jobs.create(
      organizationId,
      { userId: actor.id, permissions: ['jobs:manage'] },
      {
        type: 'integration.outbound',
        payload: { messageId: message.id },
        idempotencyKey: `outbound:${message.id}`,
      },
    )
    return message
  }

  async list(organizationId: string, status?: OutboundStatus) {
    return this.messages.find({
      where: { organizationId, ...(status ? { status } : {}) },
      order: { createdAt: 'DESC' },
      take: 200,
    })
  }

  async get(organizationId: string, id: string): Promise<OutboundMessage> {
    const row = await this.messages.findOne({ where: { id, organizationId } })
    if (!row) throw new NotFoundException('出站消息不存在')
    return row
  }

  async replay(organizationId: string, actor: IntegrationActor, id: string) {
    const message = await this.get(organizationId, id)
    if (message.status !== 'dead') {
      throw new ConflictException(`消息状态 ${message.status} 不可重放`)
    }
    message.status = 'queued'
    message.attempts = 0
    message.lastError = null
    message.deadAt = null
    await this.messages.save(message)
    await this.jobs.create(
      organizationId,
      { userId: actor.id, permissions: ['jobs:manage'] },
      {
        type: 'integration.outbound',
        payload: { messageId: message.id },
        idempotencyKey: `outbound:${message.id}:replay:${Date.now()}`,
      },
    )
    return message
  }

  async send(organizationId: string, messageId: string): Promise<OutboundMessage> {
    const message = await this.get(organizationId, messageId)
    if (message.status === 'succeeded' || message.status === 'dead') return message
    const connector = await this.connectors.findOne({
      where: { id: message.connectorId, organizationId },
    })
    if (!connector) throw new NotFoundException('连接器不存在')
    if (connector.status !== 'active') {
      message.status = 'dead'
      message.lastError = `连接器已停用：${connector.status}`
      message.deadAt = new Date()
      await this.messages.save(message)
      return message
    }
    this.assertRateLimit(connector)
    const breaker = this.circuit.get(connector.id)
    if (breaker && breaker.openUntil > Date.now()) {
      throw new Error(`连接器熔断中，剩余 ${Math.ceil((breaker.openUntil - Date.now()) / 1000)}s`)
    }
    const endpoint = String(connector.config.endpoint ?? '')
    if (!endpoint) throw new BadRequestException('连接器缺少 endpoint')
    let url: URL
    try {
      url = assertSafeOutboundUrl(endpoint, (connector.config.allowlist as string[]) ?? [])
      await assertResolvedHostSafe(url, (connector.config.allowlist as string[]) ?? [])
    } catch (error) {
      message.status = 'dead'
      message.lastError = (error as Error).message
      message.deadAt = new Date()
      await this.messages.save(message)
      return message
    }
    message.status = 'sending'
    message.attempts += 1
    message.nextAttemptAt = null
    await this.messages.save(message)
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      Number(connector.config.timeoutMs ?? 15_000),
    )
    try {
      const headers = await this.connectorService.headersForAsync(connector)
      const response = await fetch(url, {
        method: String(connector.config.method ?? 'POST'),
        headers,
        body: JSON.stringify(message.payload),
        redirect: 'manual',
        signal: controller.signal,
      })
      const text = truncateBody(await response.text().catch(() => ''))
      message.responseStatus = response.status
      message.responseBody = text
      if (response.status >= 200 && response.status < 300) {
        message.status = 'succeeded'
        message.lastError = null
        message.deadAt = null
        this.circuit.delete(connector.id)
        await this.messages.save(message)
        await this.audit(organizationId, message, 'succeeded', { status: response.status })
        return message
      }
      const retryable =
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500
      message.lastError = `HTTP ${response.status}: ${text.slice(0, 500)}`
      if (!retryable || message.attempts >= message.maxAttempts) {
        message.status = 'dead'
        message.deadAt = new Date()
        await this.messages.save(message)
        await this.audit(organizationId, message, 'dead', { status: response.status })
        return message
      }
      message.status = 'failed'
      message.nextAttemptAt = new Date(Date.now() + 2000 * message.attempts)
      this.recordFailure(connector.id)
      await this.messages.save(message)
      await this.audit(organizationId, message, 'retry', { status: response.status })
      throw new Error(message.lastError)
    } catch (error) {
      if (message.status === 'dead' || message.status === 'succeeded') return message
      message.lastError = (error as Error).message
      if (message.attempts >= message.maxAttempts) {
        message.status = 'dead'
        message.deadAt = new Date()
      } else {
        message.status = 'failed'
        message.nextAttemptAt = new Date(Date.now() + 2000 * message.attempts)
        this.recordFailure(connector.id)
      }
      await this.messages.save(message)
      await this.audit(organizationId, message, 'failed', { error: message.lastError })
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  private assertRateLimit(connector: IntegrationConnector) {
    const limit = connector.config.rateLimit as
      | { maxPerMinute?: number }
      | undefined
    const max = Number(limit?.maxPerMinute ?? 0)
    if (!Number.isFinite(max) || max <= 0) return
    const now = Date.now()
    const window = (this.rate.get(connector.id) ?? []).filter(
      (timestamp) => now - timestamp < 60_000,
    )
    if (window.length >= max) {
      throw new Error(`连接器限流：每分钟最多 ${max} 次`)
    }
    window.push(now)
    this.rate.set(connector.id, window)
  }

  private recordFailure(connectorId: string) {
    const current = this.circuit.get(connectorId) ?? { failures: 0, openUntil: 0 }
    current.failures += 1
    if (current.failures >= 5) {
      current.openUntil = Date.now() + 60_000
      current.failures = 0
    }
    this.circuit.set(connectorId, current)
  }

  private async audit(
    organizationId: string,
    message: OutboundMessage,
    phase: string,
    extra: Record<string, unknown>,
  ) {
    await this.auditLogs.create({
      organizationId,
      action: 'integration.sync',
      resource: 'connector',
      resourceId: message.connectorId,
      actor: message.createdBy ?? 'system:integration',
      status: phase === 'succeeded' ? 'success' : 'failure',
      metadata: {
        phase: `outbound:${phase}`,
        messageId: message.id,
        eventType: message.eventType,
        attempts: message.attempts,
        responseStatus: message.responseStatus,
        payload: redact(message.payload),
        ...extra,
      },
      source: 'integration',
    })
  }
}
