import { Injectable } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { DataSource, LessThanOrEqual } from 'typeorm'
import { EventBusService } from '../common/events/event-bus.service'
import { logOutboxDelivery } from '../common/logging/structured-logger'
import { isUniqueViolation } from '../semantic-runtime/record-write-error'
import { OutboxDelivery } from './outbox-delivery.entity'
import { OutboxEvent } from './outbox-event.entity'

export const OUTBOX_BATCH_SIZE = 50
export const OUTBOX_MAX_ATTEMPTS = 8
export const OUTBOX_BACKOFF_CAP_SECONDS = 3600

export function outboxBackoffSeconds(attempts: number): number {
  return Math.min(2 ** attempts, OUTBOX_BACKOFF_CAP_SECONDS)
}

export interface DrainResult {
  processed: number
  delivered: number
  failed: number
}

/**
 * 至少一次投递。待投队列只在表里，进程内不缓存。
 */
@Injectable()
export class OutboxDispatcherService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly eventBus: EventBusService,
  ) {}

  @Interval(15_000)
  async tick(): Promise<void> {
    await this.drain()
  }

  async drain(): Promise<DrainResult> {
    const now = new Date()
    const pending = await this.dataSource.getRepository(OutboxEvent).find({
      where: { status: 'pending', nextAttemptAt: LessThanOrEqual(now) },
      order: { occurredAt: 'ASC' },
      take: OUTBOX_BATCH_SIZE,
    })
    let delivered = 0
    let failed = 0
    for (const event of pending) {
      const ok = await this.deliverOne(event)
      if (ok) delivered += 1
      else failed += 1
    }
    return { processed: pending.length, delivered, failed }
  }

  private async deliverOne(event: OutboxEvent): Promise<boolean> {
    const eventRepo = this.dataSource.getRepository(OutboxEvent)
    const deliveryRepo = this.dataSource.getRepository(OutboxDelivery)
    const subscribers = this.eventBus.listSubscribers(event.topic)
    try {
      for (const handler of subscribers) {
        const subscriber = handler.constructor.name
        try {
          await deliveryRepo.insert({ eventId: event.id, subscriber })
        } catch (error) {
          if (isUniqueViolation(error)) continue
          throw error
        }
        try {
          await handler.handle({
            topic: event.topic,
            payload: event.payload,
            eventId: event.id,
            organizationId: event.organizationId,
          })
        } catch (error) {
          await deliveryRepo.delete({ eventId: event.id, subscriber })
          throw error
        }
      }
      event.status = 'delivered'
      event.deliveredAt = new Date()
      event.lastError = null
      await eventRepo.save(event)
      logOutboxDelivery({
        eventId: event.id,
        topic: event.topic,
        outcome: 'delivered',
        attempts: event.attempts,
      })
      return true
    } catch (error) {
      event.attempts += 1
      event.lastError = error instanceof Error ? error.message : String(error)
      if (event.attempts >= OUTBOX_MAX_ATTEMPTS) {
        event.status = 'failed'
      } else {
        event.status = 'pending'
        event.nextAttemptAt = new Date(Date.now() + outboxBackoffSeconds(event.attempts) * 1000)
      }
      await eventRepo.save(event)
      logOutboxDelivery({
        eventId: event.id,
        topic: event.topic,
        outcome: 'failed',
        attempts: event.attempts,
        lastError: event.lastError,
      })
      return false
    }
  }
}
