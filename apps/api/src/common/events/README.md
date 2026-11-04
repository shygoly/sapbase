# Event-Driven Architecture

## Overview

This module provides a centralized EventBus for cross-module communication, enabling loose coupling between different contexts (WorkflowContext, OrganizationContext, AuthContext, AIModuleContext).

## Features

- **Async Processing**: Events are queued and processed asynchronously to avoid blocking
- **Sync Support**: Critical events can be published synchronously for immediate processing
- **Type-Safe**: TypeScript interfaces ensure type safety
- **Extensible**: Can be extended to use Redis/RabbitMQ for distributed systems
- **Error Handling**: Handler failures don't break event processing
- **Statistics**: Built-in stats for monitoring

## Usage

### Publishing Events

```typescript
import { Inject } from '@nestjs/common'
import { EVENT_PUBLISHER } from './domain/repositories'
import type { IEventPublisher } from './domain/events'
import { OrganizationCreatedEvent } from './domain/events'

@Injectable()
export class CreateOrganizationService {
  constructor(
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: CreateOrganizationCommand): Promise<Organization> {
    // ... create organization
    
    // Publish event asynchronously (default)
    await this.eventPublisher.publish(
      new OrganizationCreatedEvent(organization.id, organization.name, ...)
    )
    
    // Or publish synchronously for critical events
    await this.eventPublisher.publishSync(
      new CriticalEvent(...)
    )
  }
}
```

### Subscribing to Events

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common'
import { EventBusService } from '../../common/events/event-bus.service'
import type { IEventHandler } from '../../common/events/i-event-handler'
import { OrganizationCreatedEvent } from '../../organization-context/domain/events'

@Injectable()
export class NotificationHandler implements IEventHandler<OrganizationCreatedEvent>, OnModuleInit {
  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit() {
    // Subscribe to specific event type
    this.eventBus.subscribe('OrganizationCreatedEvent', this)
    
    // Or subscribe to all events
    // this.eventBus.subscribeAll(this)
  }

  async handle(event: OrganizationCreatedEvent): Promise<void> {
    // Send notification, update cache, etc.
    console.log(`Organization ${event.name} was created`)
  }
}
```

## Architecture

### Event Flow

```
Domain Event → Application Service → EventBus.publish() → Queue → Async Processing → Handlers
```

### Benefits

1. **Decoupling**: Modules don't need to know about each other
2. **Extensibility**: Easy to add new event handlers without modifying existing code
3. **Async Processing**: Non-blocking event handling improves performance
4. **Scalability**: Can be extended to use message queues for distributed systems
5. **Testability**: Easy to mock event publisher in tests

## Future Enhancements

- **Redis/RabbitMQ Integration**: For distributed systems and persistence
- **Event Sourcing**: Store all events for replay and audit
- **Event Filtering**: Subscribe to events matching specific criteria
- **Retry Logic**: Automatic retry for failed handlers
- **Dead Letter Queue**: Store events that couldn't be processed
- **Metrics**: Prometheus metrics for event processing

## Example Handlers

- **AuditLogEventHandler**: Logs all events to audit log (already implemented)
- **NotificationHandler**: Sends notifications for specific events
- **CacheInvalidationHandler**: Invalidates cache on data changes
- **AnalyticsHandler**: Tracks events for analytics
