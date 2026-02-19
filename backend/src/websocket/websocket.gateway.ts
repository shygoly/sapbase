import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Logger, UseGuards } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { NotificationService } from './services/notification.service'
import { CollaborationService } from './services/collaboration.service'

interface AuthenticatedSocket extends Socket {
  userId?: string
  organizationId?: string
  userEmail?: string
}

/**
 * WebSocket Gateway for real-time communication.
 * Handles connections, authentication, and message routing.
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3050',
    credentials: true,
  },
  namespace: '/',
})
export class AppWebSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(AppWebSocketGateway.name)
  private readonly connectedUsers = new Map<string, AuthenticatedSocket>()

  constructor(
    private readonly jwtService: JwtService,
    private readonly notificationService: NotificationService,
    private readonly collaborationService: CollaborationService,
  ) {
    // Circular dependency workaround - set notification service gateway reference
    // This will be set after gateway initialization
  }

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized')
    // Set server reference in notification service
    this.notificationService.setServer(server)
    this.notificationService.setGetOrganizationUsers((orgId) =>
      this.getOrganizationUsers(orgId),
    )
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Authenticate client using JWT token
      const token = this.extractToken(client)
      if (!token) {
        this.logger.warn(`Client ${client.id} disconnected: No token provided`)
        client.disconnect()
        return
      }

      const payload = await this.jwtService.verifyAsync(token)
      client.userId = payload.sub || payload.userId
      client.organizationId = payload.organizationId
      client.userEmail = payload.email

      // Join organization room
      if (client.organizationId) {
        client.join(`org:${client.organizationId}`)
        this.logger.log(
          `User ${client.userId} connected to organization ${client.organizationId}`,
        )
      }

      // Join user-specific room
      client.join(`user:${client.userId}`)

      this.connectedUsers.set(client.userId!, client)

      // Notify user of successful connection
      client.emit('connected', {
        userId: client.userId,
        organizationId: client.organizationId,
        timestamp: new Date().toISOString(),
      })

      // Send pending notifications
      this.notificationService.sendPendingNotifications(client.userId!)
    } catch (error) {
      this.logger.error(`Authentication failed for client ${client.id}:`, error)
      client.disconnect()
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.connectedUsers.delete(client.userId)
      this.collaborationService.handleUserDisconnect(client.userId)
      this.logger.log(`User ${client.userId} disconnected`)
    }
  }

  /**
   * Extract JWT token from handshake auth or query params
   */
  private extractToken(client: Socket): string | null {
    const auth = (client.handshake as any).auth
    if (auth?.token) {
      return auth.token
    }

    const query = client.handshake.query
    if (query.token && typeof query.token === 'string') {
      return query.token
    }

    return null
  }

  /**
   * Notification events
   */
  @SubscribeMessage('notification:subscribe')
  handleNotificationSubscribe(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) {
      return { error: 'Not authenticated' }
    }

    // User is already subscribed via user room
    return { success: true, message: 'Subscribed to notifications' }
  }

  @SubscribeMessage('notification:mark-read')
  async handleMarkNotificationRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { notificationId: string },
  ) {
    if (!client.userId) {
      return { error: 'Not authenticated' }
    }

    await this.notificationService.markAsRead(
      client.userId,
      data.notificationId,
    )
    return { success: true }
  }

  /**
   * Collaboration events
   */
  @SubscribeMessage('collaboration:join')
  handleJoinCollaboration(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { resourceType: string; resourceId: string },
  ) {
    if (!client.userId) {
      return { error: 'Not authenticated' }
    }

    const room = `collab:${data.resourceType}:${data.resourceId}`
    client.join(room)

    const user = {
      id: client.userId,
      email: client.userEmail,
      joinedAt: new Date().toISOString(),
    }

    this.collaborationService.addCollaborator(
      data.resourceType,
      data.resourceId,
      client.userId,
      user,
    )

    // Notify other users in the room
    client.to(room).emit('collaboration:user-joined', {
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      user,
    })

    // Send current collaborators to the new user
    const collaborators = this.collaborationService.getCollaborators(
      data.resourceType,
      data.resourceId,
    )
    client.emit('collaboration:current-users', {
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      users: collaborators,
    })

    return { success: true, room }
  }

  @SubscribeMessage('collaboration:leave')
  handleLeaveCollaboration(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { resourceType: string; resourceId: string },
  ) {
    if (!client.userId) {
      return { error: 'Not authenticated' }
    }

    const room = `collab:${data.resourceType}:${data.resourceId}`
    client.leave(room)

    this.collaborationService.removeCollaborator(
      data.resourceType,
      data.resourceId,
      client.userId,
    )

    // Notify other users
    client.to(room).emit('collaboration:user-left', {
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      userId: client.userId,
    })

    return { success: true }
  }

  @SubscribeMessage('collaboration:update')
  handleCollaborationUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      resourceType: string
      resourceId: string
      changes: any
      cursor?: { line: number; column: number }
    },
  ) {
    if (!client.userId) {
      return { error: 'Not authenticated' }
    }

    const room = `collab:${data.resourceType}:${data.resourceId}`

    // Broadcast to other users in the room
    client.to(room).emit('collaboration:update-received', {
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      userId: client.userId,
      userEmail: client.userEmail,
      changes: data.changes,
      cursor: data.cursor,
      timestamp: new Date().toISOString(),
    })

    return { success: true }
  }

  @SubscribeMessage('collaboration:cursor')
  handleCursorUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      resourceType: string
      resourceId: string
      cursor: { line: number; column: number }
    },
  ) {
    if (!client.userId) {
      return { error: 'Not authenticated' }
    }

    const room = `collab:${data.resourceType}:${data.resourceId}`

    // Broadcast cursor position to other users
    client.to(room).emit('collaboration:cursor-update', {
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      userId: client.userId,
      userEmail: client.userEmail,
      cursor: data.cursor,
      timestamp: new Date().toISOString(),
    })

    return { success: true }
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size
  }

  /**
   * Get connected users for an organization
   */
  getOrganizationUsers(organizationId: string): string[] {
    const users: string[] = []
    this.connectedUsers.forEach((client, userId) => {
      if (client.organizationId === organizationId) {
        users.push(userId)
      }
    })
    return users
  }
}
