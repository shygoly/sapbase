# WebSocket Real-time Collaboration Guide

This document describes the WebSocket implementation for real-time features in the Speckit backend.

## Overview

The WebSocket module provides:
- Real-time notifications
- Collaborative editing
- Live updates
- Presence awareness

## Installation

Add the required dependencies to `package.json`:

```bash
npm install @nestjs/websockets socket.io
npm install --save-dev @types/socket.io
```

## Architecture

### WebSocket Gateway (`websocket.gateway.ts`)

Main entry point for WebSocket connections:
- Handles authentication via JWT
- Manages user connections and rooms
- Routes events to appropriate handlers

### Notification Service (`services/notification.service.ts`)

Manages real-time notifications:
- Send notifications to users
- Send notifications to organizations
- Store pending notifications for offline users

### Collaboration Service (`services/collaboration.service.ts`)

Manages collaborative editing sessions:
- Track active collaborators
- Manage collaboration rooms
- Handle user presence

## Events

### Connection Events

- `connected` - Sent when client successfully connects
- `disconnect` - Client disconnects

### Notification Events

- `notification` - New notification received
- `notification:subscribe` - Subscribe to notifications
- `notification:mark-read` - Mark notification as read

### Collaboration Events

- `collaboration:join` - Join a collaboration room
- `collaboration:leave` - Leave a collaboration room
- `collaboration:update` - Send collaboration update
- `collaboration:update-received` - Receive collaboration update
- `collaboration:cursor` - Send cursor position
- `collaboration:cursor-update` - Receive cursor update
- `collaboration:user-joined` - User joined collaboration
- `collaboration:user-left` - User left collaboration
- `collaboration:current-users` - Current users in collaboration

## Usage Examples

### Sending a Notification

```typescript
import { NotificationService } from './websocket/services/notification.service'

// In your service
constructor(private readonly notificationService: NotificationService) {}

// Send to user
await this.notificationService.sendToUser(userId, {
  type: 'info',
  title: 'New message',
  message: 'You have a new message',
  organizationId: 'org-123',
})

// Send to organization
await this.notificationService.sendToOrganization(organizationId, {
  type: 'success',
  title: 'Task completed',
  message: 'A task has been completed',
})
```

### Integration with Event Bus

You can integrate notifications with the event bus:

```typescript
import { EventBusService } from '../common/events/event-bus.service'
import { NotificationService } from '../websocket/services/notification.service'

@Injectable()
export class WorkflowEventHandler {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly notificationService: NotificationService,
  ) {
    // Subscribe to workflow events
    this.eventBus.subscribe('WorkflowCompletedEvent', this)
  }

  async handle(event: WorkflowCompletedEvent) {
    // Send notification to workflow owner
    await this.notificationService.sendToUser(event.userId, {
      type: 'success',
      title: 'Workflow Completed',
      message: `Workflow "${event.workflowName}" has been completed`,
      data: { workflowId: event.workflowId },
    })
  }
}
```

## Authentication

Clients authenticate using JWT tokens:

1. **Via handshake auth**:
```javascript
const socket = io('http://localhost:3051', {
  auth: {
    token: 'your-jwt-token'
  }
})
```

2. **Via query parameter**:
```javascript
const socket = io('http://localhost:3051?token=your-jwt-token')
```

## Rooms

Users are automatically added to rooms:
- `user:{userId}` - User-specific room
- `org:{organizationId}` - Organization room
- `collab:{resourceType}:{resourceId}` - Collaboration room

## Security Considerations

1. **Authentication**: All connections require valid JWT tokens
2. **Authorization**: Users can only join rooms they have access to
3. **Rate Limiting**: Consider implementing rate limiting for events
4. **Input Validation**: Validate all incoming messages
5. **Resource Access**: Verify users have access to resources before joining collaboration rooms

## Scaling

For production scaling:
1. Use Redis adapter for Socket.io
2. Implement sticky sessions
3. Use message queues for cross-server communication
4. Monitor connection counts and performance

## Testing

Example test:

```typescript
import { Test } from '@nestjs/testing'
import { WebSocketGateway } from './websocket.gateway'

describe('WebSocketGateway', () => {
  let gateway: WebSocketGateway

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [WebSocketGateway, NotificationService, CollaborationService],
    }).compile()

    gateway = module.get<WebSocketGateway>(WebSocketGateway)
  })

  it('should be defined', () => {
    expect(gateway).toBeDefined()
  })
})
```
