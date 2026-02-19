import { Global, Module, OnModuleInit, Optional } from '@nestjs/common'
import { EventBusService } from './event-bus.service'
import type { IEventPublisher } from './i-event-publisher'

/**
 * Global EventBus module - provides centralized event bus for all modules.
 * This allows cross-module communication without tight coupling.
 * 
 * Note: AuditLogEventHandler is conditionally loaded to avoid dependency issues
 * during documentation generation.
 */
@Global()
@Module({
  imports: [],
  providers: [
    EventBusService,
    {
      provide: 'IEventPublisher',
      useExisting: EventBusService,
    },
  ],
  exports: [EventBusService, 'IEventPublisher'],
})
export class EventBusModule implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
  ) {}

  onModuleInit() {
    // Try to subscribe audit log handler if available
    try {
      const { AuditLogEventHandler } = require('./handlers/audit-log-handler')
      const handler = this.eventBus['handlers']?.get('*')?.[0] || 
                     new AuditLogEventHandler()
      this.eventBus.subscribeAll(handler)
    } catch (error) {
      // Audit log handler not available, skip
    }
  }
}
