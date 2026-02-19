import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common'
import { Server } from 'socket.io'

export interface Notification {
  id: string
  userId: string
  organizationId?: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  data?: Record<string, any>
  read: boolean
  createdAt: Date
}

/**
 * Service for managing real-time notifications via WebSocket.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name)
  private readonly pendingNotifications = new Map<string, Notification[]>()
  private server: Server | null = null

  /**
   * Set the Socket.IO server instance (called by gateway after initialization)
   */
  setServer(server: Server): void {
    this.server = server
  }

  /**
   * Get organization users (delegated to gateway)
   */
  private getOrganizationUsers?: (organizationId: string) => string[]

  /**
   * Set the function to get organization users
   */
  setGetOrganizationUsers(fn: (organizationId: string) => string[]): void {
    this.getOrganizationUsers = fn
  }

  /**
   * Send a notification to a specific user
   */
  async sendToUser(
    userId: string,
    notification: Omit<Notification, 'id' | 'userId' | 'read' | 'createdAt'>,
  ): Promise<void> {
    const fullNotification: Notification = {
      ...notification,
      id: this.generateId(),
      userId,
      read: false,
      createdAt: new Date(),
    }

    // Try to send immediately if user is connected
    if (this.server) {
      this.server.to(`user:${userId}`).emit('notification', fullNotification)
    }

    // Store as pending if user is not connected
    if (!this.isUserConnected(userId)) {
      if (!this.pendingNotifications.has(userId)) {
        this.pendingNotifications.set(userId, [])
      }
      this.pendingNotifications.get(userId)!.push(fullNotification)
    }

    this.logger.log(`Notification sent to user ${userId}: ${notification.title}`)
  }

  /**
   * Send a notification to all users in an organization
   */
  async sendToOrganization(
    organizationId: string,
    notification: Omit<Notification, 'id' | 'organizationId' | 'read' | 'createdAt'>,
  ): Promise<void> {
    const connectedUsers = this.getOrganizationUsers
      ? this.getOrganizationUsers(organizationId)
      : []

    for (const userId of connectedUsers) {
      await this.sendToUser(userId, {
        ...notification,
        organizationId,
      })
    }

    this.logger.log(
      `Notification sent to organization ${organizationId}: ${notification.title}`,
    )
  }

  /**
   * Send pending notifications when user connects
   */
  async sendPendingNotifications(userId: string): Promise<void> {
    const pending = this.pendingNotifications.get(userId)
    if (!pending || pending.length === 0) {
      return
    }

    // Send all pending notifications
    if (this.server) {
      for (const notification of pending) {
        this.server.to(`user:${userId}`).emit('notification', notification)
      }
    }

    // Clear pending notifications
    this.pendingNotifications.delete(userId)
    this.logger.log(`Sent ${pending.length} pending notifications to user ${userId}`)
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    // In a real implementation, you would update the database here
    // For now, we just acknowledge it
    this.logger.log(`Notification ${notificationId} marked as read by user ${userId}`)
  }

  /**
   * Check if user is connected
   */
  private isUserConnected(userId: string): boolean {
    if (!this.server) {
      return false
    }
    const sockets = this.server.sockets.adapter.rooms.get(`user:${userId}`)
    return sockets ? sockets.size > 0 : false
  }

  /**
   * Generate a unique notification ID
   */
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}
