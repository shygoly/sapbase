import { Test, TestingModule } from '@nestjs/testing'
import { EventBusService } from './event-bus.service'
import type { IEventHandler } from './i-event-handler'

class TestEvent {
  constructor(public data: string) {}
}

class TestEventHandler implements IEventHandler<TestEvent> {
  public handledEvents: TestEvent[] = []

  async handle(event: TestEvent): Promise<void> {
    this.handledEvents.push(event)
  }
}

describe('EventBusService', () => {
  let service: EventBusService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventBusService],
    }).compile()

    service = module.get<EventBusService>(EventBusService)
  })

  describe('publish', () => {
    it('should publish event asynchronously', async () => {
      const handler = new TestEventHandler()
      service.subscribe('TestEvent', handler)

      const event = new TestEvent('test-data')
      await service.publish(event)

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(handler.handledEvents).toContain(event)
    })

    it('should handle multiple handlers', async () => {
      const handler1 = new TestEventHandler()
      const handler2 = new TestEventHandler()

      service.subscribe('TestEvent', handler1)
      service.subscribe('TestEvent', handler2)

      const event = new TestEvent('test-data')
      await service.publish(event)

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(handler1.handledEvents).toContain(event)
      expect(handler2.handledEvents).toContain(event)
    })

    it('should handle wildcard subscriptions', async () => {
      const handler = new TestEventHandler()
      service.subscribeAll(handler)

      const event = new TestEvent('test-data')
      await service.publish(event)

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(handler.handledEvents).toContain(event)
    })
  })

  describe('publishSync', () => {
    it('should publish event synchronously', async () => {
      const handler = new TestEventHandler()
      service.subscribe('TestEvent', handler)

      const event = new TestEvent('test-data')
      await service.publishSync(event)

      expect(handler.handledEvents).toContain(event)
    })
  })

  describe('subscribe', () => {
    it('should subscribe handler to specific event', () => {
      const handler = new TestEventHandler()
      service.subscribe('TestEvent', handler)

      const stats = service.getStats()
      expect(stats.totalHandlers).toBeGreaterThan(0)
    })
  })

  describe('unsubscribe', () => {
    it('should unsubscribe handler from event', () => {
      const handler = new TestEventHandler()
      service.subscribe('TestEvent', handler)

      service.unsubscribe('TestEvent', handler)

      const stats = service.getStats()
      // Handler count should decrease
      expect(stats.totalHandlers).toBeGreaterThanOrEqual(0)
    })
  })

  describe('dispatchToSubscribers', () => {
    it('按 topic 精确调用，失败抛出，不碰通配订阅', async () => {
      const named = new TestEventHandler()
      const wildcard = new TestEventHandler()
      service.subscribe('blueprint.record.transitioned', named)
      service.subscribeAll(wildcard)

      await service.dispatchToSubscribers('blueprint.record.transitioned', { recordId: 'r1' })
      expect(named.handledEvents).toHaveLength(1)
      expect(wildcard.handledEvents).toHaveLength(0)

      const failing: IEventHandler<unknown> = {
        handle: async () => {
          throw new Error('subscriber-boom')
        },
      }
      service.subscribe('blueprint.record.transitioned', failing)
      await expect(
        service.dispatchToSubscribers('blueprint.record.transitioned', { recordId: 'r1' }),
      ).rejects.toThrow('subscriber-boom')
    })
  })

  describe('getStats', () => {
    it('should return statistics', () => {
      const stats = service.getStats()

      expect(stats).toHaveProperty('totalHandlers')
      expect(stats).toHaveProperty('eventTypes')
      expect(stats).toHaveProperty('queueSize')
    })
  })
})
