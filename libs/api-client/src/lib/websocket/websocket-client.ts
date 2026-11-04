import { io, Socket } from 'socket.io-client'

export interface Notification {
  id: string
  userId: string
  organizationId?: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  data?: Record<string, any>
  read: boolean
  createdAt: string
}

export interface CollaborationUpdate {
  resourceType: string
  resourceId: string
  userId: string
  userEmail?: string
  changes: any
  cursor?: { line: number; column: number }
  timestamp: string
}

export interface Collaborator {
  id: string
  email?: string
  joinedAt: string
  lastSeen: string
}

/**
 * WebSocket client for real-time communication.
 */
export class WebSocketClient {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  constructor(
    private serverUrl: string,
    private token: string,
  ) {}

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve()
        return
      }

      this.socket = io(this.serverUrl, {
        auth: {
          token: this.token,
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: this.reconnectDelay,
        reconnectionAttempts: this.maxReconnectAttempts,
      })

      this.socket.on('connect', () => {
        this.reconnectAttempts = 0
        resolve()
      })

      this.socket.on('connect_error', (error) => {
        this.reconnectAttempts++
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(error)
        }
      })

      this.socket.on('disconnect', () => {
        // Disconnected
      })

      this.socket.on('reconnect', () => {
        this.reconnectAttempts = 0
      })

      this.socket.on('reconnect_attempt', () => {
        // Reconnecting
      })

      this.socket.on('reconnect_failed', () => {
        reject(new Error('Failed to reconnect'))
      })
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  /**
   * Subscribe to notifications
   */
  onNotification(callback: (notification: Notification) => void): void {
    this.socket?.on('notification', callback)
  }

  /**
   * Unsubscribe from notifications
   */
  offNotification(callback?: (notification: Notification) => void): void {
    if (callback) {
      this.socket?.off('notification', callback)
    } else {
      this.socket?.off('notification')
    }
  }

  /**
   * Mark notification as read
   */
  markNotificationRead(notificationId: string): void {
    this.socket?.emit('notification:mark-read', { notificationId })
  }

  /**
   * Join a collaboration room
   */
  joinCollaboration(
    resourceType: string,
    resourceId: string,
  ): Promise<{ success: boolean; room?: string }> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Not connected'))
        return
      }

      this.socket.emit(
        'collaboration:join',
        { resourceType, resourceId },
        (response: { success: boolean; room?: string; error?: string }) => {
          if (response.error) {
            reject(new Error(response.error))
          } else {
            resolve(response)
          }
        },
      )
    })
  }

  /**
   * Leave a collaboration room
   */
  leaveCollaboration(resourceType: string, resourceId: string): void {
    this.socket?.emit('collaboration:leave', { resourceType, resourceId })
  }

  /**
   * Send collaboration update
   */
  sendCollaborationUpdate(
    resourceType: string,
    resourceId: string,
    changes: any,
    cursor?: { line: number; column: number },
  ): void {
    this.socket?.emit('collaboration:update', {
      resourceType,
      resourceId,
      changes,
      cursor,
    })
  }

  /**
   * Send cursor update
   */
  sendCursorUpdate(
    resourceType: string,
    resourceId: string,
    cursor: { line: number; column: number },
  ): void {
    this.socket?.emit('collaboration:cursor', {
      resourceType,
      resourceId,
      cursor,
    })
  }

  /**
   * Listen for collaboration updates
   */
  onCollaborationUpdate(
    callback: (update: CollaborationUpdate) => void,
  ): void {
    this.socket?.on('collaboration:update-received', callback)
  }

  /**
   * Listen for user joined collaboration
   */
  onUserJoined(
    callback: (data: {
      resourceType: string
      resourceId: string
      user: Collaborator
    }) => void,
  ): void {
    this.socket?.on('collaboration:user-joined', callback)
  }

  /**
   * Listen for user left collaboration
   */
  onUserLeft(
    callback: (data: {
      resourceType: string
      resourceId: string
      userId: string
    }) => void,
  ): void {
    this.socket?.on('collaboration:user-left', callback)
  }

  /**
   * Listen for current users in collaboration
   */
  onCurrentUsers(
    callback: (data: {
      resourceType: string
      resourceId: string
      users: Collaborator[]
    }) => void,
  ): void {
    this.socket?.on('collaboration:current-users', callback)
  }

  /**
   * Listen for cursor updates
   */
  onCursorUpdate(
    callback: (data: {
      resourceType: string
      resourceId: string
      userId: string
      userEmail?: string
      cursor: { line: number; column: number }
      timestamp: string
    }) => void,
  ): void {
    this.socket?.on('collaboration:cursor-update', callback)
  }

  /**
   * Listen for connection status
   */
  onConnected(callback: (data: { userId: string; organizationId?: string }) => void): void {
    this.socket?.on('connected', callback)
  }

  /**
   * Get socket instance (for advanced usage)
   */
  getSocket(): Socket | null {
    return this.socket
  }
}
