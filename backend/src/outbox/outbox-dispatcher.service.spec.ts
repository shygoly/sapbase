import { QueryFailedError } from 'typeorm'
import { EventBusService } from '../common/events/event-bus.service'
import { collectLogsAsync } from '../common/logging/structured-logger'
import type { IEventHandler } from '../common/events/i-event-handler'
import {
  OUTBOX_MAX_ATTEMPTS,
  OutboxDispatcherService,
  outboxBackoffSeconds,
} from './outbox-dispatcher.service'
import { OutboxDelivery } from './outbox-delivery.entity'
import { OutboxEvent } from './outbox-event.entity'

class CountingHandler implements IEventHandler<{ topic: string; payload: unknown }> {
  public calls = 0
  async handle(): Promise<void> {
    this.calls += 1
  }
}

class FailingHandler implements IEventHandler<{ topic: string; payload: unknown }> {
  async handle(): Promise<void> {
    throw new Error('subscriber-boom')
  }
}

function uniqueViolation(): QueryFailedError {
  const error = new QueryFailedError('INSERT', [], new Error('duplicate'))
  Object.assign(error, { code: '23505' })
  return error
}

describe('OutboxDispatcherService', () => {
  it('退避公式有界', () => {
    expect(outboxBackoffSeconds(1)).toBe(2)
    expect(outboxBackoffSeconds(2)).toBe(4)
    expect(outboxBackoffSeconds(20)).toBe(3600)
  })

  it('重复投递：去重行冲突则跳过订阅者', async () => {
    const handler = new CountingHandler()
    const eventBus = new EventBusService()
    eventBus.subscribe('blueprint.record.transitioned', handler)
    const event = {
      id: 'evt-1',
      topic: 'blueprint.record.transitioned',
      payload: { recordId: 'r1' },
      status: 'pending' as const,
      attempts: 0,
      lastError: null,
      occurredAt: new Date(),
      nextAttemptAt: new Date(0),
    } as unknown as OutboxEvent
    const saved: OutboxEvent[] = []
    const inserted: Array<{ eventId: string; subscriber: string }> = []
    const dataSource = {
      getRepository: (entity: unknown) => {
        if (entity === OutboxEvent) {
          return {
            find: async () => [event],
            save: async (row: OutboxEvent) => {
              saved.push({ ...row })
              return row
            },
          }
        }
        if (entity === OutboxDelivery) {
          return {
            insert: async (row: { eventId: string; subscriber: string }) => {
              if (inserted.some((item) => item.eventId === row.eventId && item.subscriber === row.subscriber)) {
                throw uniqueViolation()
              }
              inserted.push(row)
            },
            delete: async () => undefined,
          }
        }
        throw new Error('unexpected repo')
      },
    }
    const first = new OutboxDispatcherService(dataSource as never, eventBus)
    await first.drain()
    expect(handler.calls).toBe(1)
    expect(saved[0].status).toBe('delivered')

    event.status = 'pending'
    event.deliveredAt = null
    const second = new OutboxDispatcherService(dataSource as never, eventBus)
    await second.drain()
    expect(handler.calls).toBe(1)
  })

  it('失败可查：attempts / lastError，达上限停在 failed', async () => {
    const eventBus = new EventBusService()
    eventBus.subscribe('blueprint.record.transitioned', new FailingHandler())
    const event = {
      id: 'evt-fail',
      topic: 'blueprint.record.transitioned',
      payload: {},
      status: 'pending' as const,
      attempts: OUTBOX_MAX_ATTEMPTS - 1,
      lastError: null,
      occurredAt: new Date(),
      nextAttemptAt: new Date(0),
    } as unknown as OutboxEvent
    let persisted: OutboxEvent | undefined
    const dataSource = {
      getRepository: (entity: unknown) => {
        if (entity === OutboxEvent) {
          return {
            find: async () => [event],
            save: async (row: OutboxEvent) => {
              persisted = { ...row }
              return row
            },
          }
        }
        return {
          insert: async () => undefined,
          delete: async () => undefined,
        }
      },
    }
    const previous = process.env.LOG_FORMAT
    process.env.LOG_FORMAT = 'json'
    try {
      const lines = await collectLogsAsync(async () => {
        await new OutboxDispatcherService(dataSource as never, eventBus).drain()
      })
      expect(persisted?.status).toBe('failed')
      expect(persisted?.attempts).toBe(OUTBOX_MAX_ATTEMPTS)
      expect(persisted?.lastError).toBe('subscriber-boom')
      const parsed = lines.map((line) => JSON.parse(line) as Record<string, unknown>)
      expect(parsed.some((row) => row.msg === 'outbox.failed' && row.attempts === OUTBOX_MAX_ATTEMPTS)).toBe(
        true,
      )
      expect(JSON.stringify(parsed)).not.toContain('payload')
    } finally {
      if (previous === undefined) delete process.env.LOG_FORMAT
      else process.env.LOG_FORMAT = previous
    }
  })

  it('drain 成功也打结构化条目（delivered + attempts，不含 payload）', async () => {
    const handler = new CountingHandler()
    const eventBus = new EventBusService()
    eventBus.subscribe('blueprint.record.transitioned', handler)
    const event = {
      id: 'evt-ok',
      topic: 'blueprint.record.transitioned',
      payload: { data: { secret: 'nope' } },
      status: 'pending' as const,
      attempts: 0,
      lastError: null,
      occurredAt: new Date(),
      nextAttemptAt: new Date(0),
    } as unknown as OutboxEvent
    const dataSource = {
      getRepository: (entity: unknown) => {
        if (entity === OutboxEvent) {
          return {
            find: async () => [event],
            save: async (row: OutboxEvent) => row,
          }
        }
        return { insert: async () => undefined, delete: async () => undefined }
      },
    }
    const previous = process.env.LOG_FORMAT
    process.env.LOG_FORMAT = 'json'
    try {
      const lines = await collectLogsAsync(async () => {
        await new OutboxDispatcherService(dataSource as never, eventBus).drain()
      })
      const parsed = JSON.parse(lines[0]) as Record<string, unknown>
      expect(parsed).toEqual(
        expect.objectContaining({
          msg: 'outbox.delivered',
          eventId: 'evt-ok',
          outcome: 'delivered',
        }),
      )
      expect(JSON.stringify(parsed)).not.toContain('nope')
      expect(parsed.payload).toBeUndefined()
    } finally {
      if (previous === undefined) delete process.env.LOG_FORMAT
      else process.env.LOG_FORMAT = previous
    }
  })
})
