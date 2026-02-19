import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import type { IEventPublisher } from './i-event-publisher'
import type { IEventHandler } from './i-event-handler'

/**
 * Centralized Event Bus for cross-module communication.
 * Supports async processing and can be extended to use message queues (Redis/RabbitMQ).
 */
@Injectable()
export class EventBusService implements IEventPublisher, OnModuleInit {
  private readonly logger = new Logger(EventBusService.name)
  private handlers: Map<string, Array<IEventHandler<any>>> = new Map()
  private eventQueue: Array<{ event: unknown; timestamp: Date }> = []
  private isProcessing = false

  onModuleInit() {
    this.logger.log('EventBus initialized')
  }

  /**
   * Publish an event asynchronously.
   * Events are queued and processed asynchronously to avoid blocking.
   */
  async publish<T>(event: T): Promise<void> {
    const eventName = this.getEventName(event)
    this.logger.debug(`Publishing event: ${eventName}`)

    // Add to queue for async processing
    this.eventQueue.push({ event, timestamp: new Date() })

    // Process queue asynchronously (non-blocking)
    if (!this.isProcessing) {
      this.processQueue().catch((error) => {
        this.logger.error(`Error processing event queue: ${error.message}`, error.stack)
      })
    }
  }

  /**
   * Publish an event synchronously (for critical events that need immediate processing).
   */
  async publishSync<T>(event: T): Promise<void> {
    const eventName = this.getEventName(event)
    this.logger.debug(`Publishing event synchronously: ${eventName}`)

    const handlers = this.handlers.get(eventName) || []
    const allHandlers = this.handlers.get('*') || [] // Wildcard handlers

    for (const handler of [...handlers, ...allHandlers]) {
      try {
        await handler.handle(event)
      } catch (error) {
        this.logger.error(
          `Error handling event ${eventName} with handler ${handler.constructor.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error.stack : undefined,
        )
        // Continue processing other handlers even if one fails
      }
    }
  }

  /**
   * Subscribe to events of a specific type.
   */
  subscribe<T>(eventName: string, handler: IEventHandler<T>): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, [])
    }
    this.handlers.get(eventName)!.push(handler as IEventHandler<any>)
    this.logger.debug(`Subscribed handler ${handler.constructor.name} to event: ${eventName}`)
  }

  /**
   * Subscribe to all events (wildcard).
   */
  subscribeAll(handler: IEventHandler<any>): void {
    this.subscribe('*', handler)
  }

  /**
   * Unsubscribe a handler from an event type.
   */
  unsubscribe<T>(eventName: string, handler: IEventHandler<T>): void {
    const handlers = this.handlers.get(eventName)
    if (handlers) {
      const index = handlers.indexOf(handler as IEventHandler<any>)
      if (index > -1) {
        handlers.splice(index, 1)
        this.logger.debug(`Unsubscribed handler ${handler.constructor.name} from event: ${eventName}`)
      }
    }
  }

  /**
   * Get statistics about the event bus.
   */
  getStats(): {
    totalHandlers: number
    eventTypes: string[]
    queueSize: number
  } {
    const eventTypes = Array.from(this.handlers.keys())
    const totalHandlers = Array.from(this.handlers.values()).reduce((sum, h) => sum + h.length, 0)
    return {
      totalHandlers,
      eventTypes,
      queueSize: this.eventQueue.length,
    }
  }

  /**
   * Process the event queue asynchronously.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return
    }

    this.isProcessing = true

    try {
      while (this.eventQueue.length > 0) {
        const { event } = this.eventQueue.shift()!
        await this.processEvent(event)
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Process a single event.
   */
  private async processEvent<T>(event: T): Promise<void> {
    const eventName = this.getEventName(event)
    const handlers = this.handlers.get(eventName) || []
    const allHandlers = this.handlers.get('*') || [] // Wildcard handlers

    if (handlers.length === 0 && allHandlers.length === 0) {
      this.logger.debug(`No handlers registered for event: ${eventName}`)
      return
    }

    this.logger.debug(`Processing event: ${eventName} with ${handlers.length + allHandlers.length} handler(s)`)

    // Process handlers in parallel (can be changed to sequential if order matters)
    const handlerPromises = [...handlers, ...allHandlers].map(async (handler) => {
      try {
        await handler.handle(event)
      } catch (error) {
        this.logger.error(
          `Error handling event ${eventName} with handler ${handler.constructor.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error instanceof Error ? error.stack : undefined,
        )
        // Continue processing other handlers even if one fails
      }
    })

    await Promise.all(handlerPromises)
  }

  /**
   * Extract event name from event object (uses constructor name or class name).
   */
  private getEventName(event: unknown): string {
    if (event && typeof event === 'object') {
      const constructor = (event as any).constructor
      if (constructor && constructor.name) {
        return constructor.name
      }
    }
    return 'UnknownEvent'
  }
}
