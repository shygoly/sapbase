# WebSocket Real-time Collaboration Guide (Frontend)

This document describes the WebSocket client implementation for real-time features in the Speckit frontend.

## Overview

The WebSocket client provides:
- Real-time notifications
- Collaborative editing
- Live updates
- Presence awareness

## Installation

Add the required dependency to `package.json`:

```bash
npm install socket.io-client
```

## Architecture

### WebSocket Client (`lib/websocket/websocket-client.ts`)

Main WebSocket client class:
- Manages connection lifecycle
- Handles reconnection
- Provides event methods

### React Hooks

- `useWebSocket` - Base WebSocket hook
- `useNotifications` - Notification management hook
- `useCollaboration` - Collaborative editing hook

### Components

- `NotificationCenter` - Notification UI component
- `CollaboratorsList` - Active collaborators display
- `CollaborativeEditor` - Collaborative text editor

## Usage

### Basic WebSocket Connection

```tsx
import { useWebSocket } from '@/hooks/use-websocket'

function MyComponent() {
  const { connected, connect, disconnect } = useWebSocket({
    onNotification: (notification) => {
      console.log('New notification:', notification)
    }
  })

  return (
    <div>
      <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
      <button onClick={connect}>Connect</button>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  )
}
```

### Real-time Notifications

```tsx
import { NotificationCenter } from '@/components/notifications/notification-center'

function Layout() {
  return (
    <header>
      <NotificationCenter />
    </header>
  )
}
```

Or use the hook directly:

```tsx
import { useNotifications } from '@/hooks/use-notifications'

function MyComponent() {
  const { notifications, unreadCount, markAsRead } = useNotifications()

  return (
    <div>
      <h2>Notifications ({unreadCount} unread)</h2>
      {notifications.map(notification => (
        <div key={notification.id}>
          <h3>{notification.title}</h3>
          <p>{notification.message}</p>
          {!notification.read && (
            <button onClick={() => markAsRead(notification.id)}>
              Mark as read
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
```

### Collaborative Editing

```tsx
import { CollaborativeEditor } from '@/components/collaboration/collaborative-editor'

function WorkflowEditor({ workflowId }: { workflowId: string }) {
  const [content, setContent] = useState('')

  return (
    <CollaborativeEditor
      resourceType="workflow"
      resourceId={workflowId}
      value={content}
      onChange={setContent}
      placeholder="Enter workflow definition..."
    />
  )
}
```

Or use the hook directly:

```tsx
import { useCollaboration } from '@/hooks/use-collaboration'

function MyEditor({ documentId }: { documentId: string }) {
  const { collaborators, sendUpdate, sendCursorUpdate } = useCollaboration({
    resourceType: 'document',
    resourceId: documentId,
    onUpdate: (update) => {
      // Apply remote changes
      console.log('Remote update:', update.changes)
    },
    onUserJoined: (user) => {
      console.log('User joined:', user.email)
    },
  })

  const handleChange = (value: string) => {
    sendUpdate({ content: value })
  }

  return (
    <div>
      <CollaboratorsList resourceType="document" resourceId={documentId} />
      <textarea onChange={(e) => handleChange(e.target.value)} />
    </div>
  )
}
```

## Configuration

Set the WebSocket server URL in `.env.local`:

```env
NEXT_PUBLIC_WS_URL=http://localhost:3051
```

## Authentication

The WebSocket client automatically uses the JWT token from localStorage:

```typescript
const token = localStorage.getItem('token')
```

Make sure to store the token after login:

```typescript
localStorage.setItem('token', jwtToken)
```

## Event Handling

### Notification Events

- `notification` - New notification received
- `connected` - Successfully connected

### Collaboration Events

- `collaboration:update-received` - Remote update received
- `collaboration:user-joined` - User joined collaboration
- `collaboration:user-left` - User left collaboration
- `collaboration:current-users` - Current users list
- `collaboration:cursor-update` - Cursor position update

## Best Practices

1. **Auto-connect**: Use `autoConnect: true` for notifications
2. **Cleanup**: Hooks automatically cleanup on unmount
3. **Error Handling**: Handle connection errors gracefully
4. **Reconnection**: Client automatically reconnects on disconnect
5. **Debouncing**: Debounce frequent updates (e.g., cursor movements)

## Advanced Usage

### Custom Event Handlers

```tsx
import { useWebSocket } from '@/hooks/use-websocket'

function MyComponent() {
  const { client } = useWebSocket()

  useEffect(() => {
    if (client) {
      // Custom event handler
      client.getSocket()?.on('custom:event', (data) => {
        console.log('Custom event:', data)
      })
    }
  }, [client])
}
```

### Manual Connection Control

```tsx
function MyComponent() {
  const { connect, disconnect, connected } = useWebSocket({
    autoConnect: false, // Manual control
  })

  useEffect(() => {
    // Connect when component mounts
    connect()

    return () => {
      // Disconnect when component unmounts
      disconnect()
    }
  }, [connect, disconnect])
}
```

## Performance Considerations

1. **Throttle cursor updates**: Don't send cursor updates on every movement
2. **Debounce text updates**: Debounce frequent text changes
3. **Batch updates**: Batch multiple small updates
4. **Optimistic updates**: Apply local changes immediately, sync later

## Troubleshooting

### Connection Issues

1. Check WebSocket URL configuration
2. Verify JWT token is valid
3. Check CORS settings on server
4. Verify network connectivity

### Notification Not Received

1. Check if user is subscribed
2. Verify notification service is sending correctly
3. Check browser console for errors
4. Verify user ID matches

### Collaboration Not Working

1. Verify both users are in the same room
2. Check resource type and ID match
3. Verify event handlers are set up correctly
4. Check for JavaScript errors
