import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { EventBusService } from '../common/events/event-bus.service'
import type { IEventHandler } from '../common/events/i-event-handler'
import { NotificationService } from '../websocket/services/notification.service'
import type { NotificationType } from './notification.entity'
import { organizationMemberIds, usersWithRole } from './role-users'

export type OutboxDeliveryEvent = {
  topic: string
  payload: Record<string, unknown>
  eventId?: string
  organizationId?: string
}

/**
 * 通知只在 outbox 投递时产生。业务事务（transition / approve / import）不许直接写表。
 */
@Injectable()
export class NotificationSubscriber
  implements IEventHandler<OutboxDeliveryEvent>, OnModuleInit
{
  private readonly logger = new Logger(NotificationSubscriber.name)

  constructor(
    private readonly eventBus: EventBusService,
    private readonly notifications: NotificationService,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe('blueprint.record.approval.pending', this)
    this.eventBus.subscribe('blueprint.record.transitioned', this)
    this.eventBus.subscribe('blueprint.import.completed', this)
  }

  async handle(event: OutboxDeliveryEvent): Promise<void> {
    const eventId = event.eventId
    const organizationId = event.organizationId
    if (!eventId || !organizationId) {
      this.logger.warn(`通知订阅者跳过：缺少 eventId/organizationId topic=${event.topic}`)
      return
    }
    const payload = event.payload ?? {}
    if (event.topic === 'blueprint.record.approval.pending') {
      await this.onApprovalPending(eventId, organizationId, payload)
      return
    }
    if (event.topic === 'blueprint.record.transitioned') {
      await this.onTransitioned(eventId, organizationId, payload)
      return
    }
    if (event.topic === 'blueprint.import.completed') {
      await this.onImportCompleted(eventId, organizationId, payload)
    }
  }

  private async onApprovalPending(
    eventId: string,
    organizationId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const role = asString(payload.role)
    const userIds = await usersWithRole(this.dataSource, organizationId, role)
    const title = '有一张单等你批'
    const metadata = {
      entity: payload.entity,
      recordId: payload.recordId,
      ruleId: payload.ruleId,
      stepIndex: payload.stepIndex,
      role,
    }
    for (const userId of userIds) {
      await this.notifications.sendToUser(
        userId,
        { organizationId, type: 'info', title, message: title, data: metadata },
        eventId,
      )
    }
  }

  private async onTransitioned(
    eventId: string,
    organizationId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const from = asString(payload.from)
    const to = asString(payload.to)
    const title = `状态从 ${from} → ${to}`
    const userIds = await organizationMemberIds(this.dataSource, organizationId)
    const metadata = {
      blueprintId: payload.blueprintId,
      entity: payload.entity,
      recordId: payload.recordId,
      from,
      to,
      actor: payload.actor,
    }
    for (const userId of userIds) {
      await this.notifications.sendToUser(
        userId,
        { organizationId, type: 'info', title, message: title, data: metadata },
        eventId,
      )
    }
  }

  private async onImportCompleted(
    eventId: string,
    organizationId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const actor = asString(payload.actor)
    if (!actor || !isUuid(actor)) {
      this.logger.warn(`导入完成通知跳过：actor 不是用户 id（${actor || '空'}）`)
      return
    }
    const imported = asNumber(payload.imported)
    const failed = asNumber(payload.failed)
    const type: NotificationType = failed > 0 ? 'error' : 'success'
    const title =
      failed > 0
        ? `导入完成：成功 ${imported}，失败 ${failed}`
        : `导入完成：成功 ${imported}`
    await this.notifications.sendToUser(
      actor,
      {
        organizationId,
        type,
        title,
        message: title,
        data: {
          entity: payload.entity,
          imported,
          failed,
          dryRun: payload.dryRun,
          batchId: payload.batchId,
        },
      },
      eventId,
    )
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}
