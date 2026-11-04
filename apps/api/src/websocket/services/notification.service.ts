import { Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { Server } from 'socket.io'
import { DataSource } from 'typeorm'
import { NotificationRecord, type NotificationType } from '../../notifications/notification.entity'
import { isUniqueViolation } from '../../semantic-runtime/record-write-error'

export interface Notification {
  id: string
  userId: string
  organizationId?: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>
  read: boolean
  createdAt: Date
  sourceEventId?: string | null
}

export type SendNotificationInput = Omit<Notification, 'id' | 'userId' | 'read' | 'createdAt'>

/**
 * 通知：表是真相，WS 只是在线推送。
 * 签名保持 sendToUser / sendToOrganization / sendPendingNotifications / markAsRead。
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name)
  private server: Server | null = null
  private getOrganizationUsers?: (organizationId: string) => string[]

  constructor(private readonly dataSource: DataSource) {}

  setServer(server: Server): void {
    this.server = server
  }

  setGetOrganizationUsers(fn: (organizationId: string) => string[]): void {
    this.getOrganizationUsers = fn
  }

  /**
   * 写表 +（若在线）WS 推送。
   * `sourceEventId` 可选：与 userId 组成 UNIQUE，重复投递不产生第二行。
   */
  async sendToUser(
    userId: string,
    notification: SendNotificationInput,
    sourceEventId?: string,
  ): Promise<void> {
    const organizationId = notification.organizationId
    if (!organizationId) {
      this.emitToUser(userId, {
        id: randomUUID(),
        userId,
        organizationId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        read: false,
        createdAt: new Date(),
        sourceEventId: sourceEventId ?? null,
      })
      this.logger.warn(`通知未持久化：缺少 organizationId，user=${userId}`)
      return
    }

    const id = randomUUID()
    const createdAt = new Date()
    const repo = this.dataSource.getRepository(NotificationRecord)
    try {
      await repo.save(
        repo.create({
          id,
          userId,
          organizationId,
          type: notification.type,
          title: notification.title,
          body: notification.message ?? null,
          read: false,
          sourceEventId: sourceEventId ?? null,
          metadata: notification.data ?? null,
          createdAt,
          updatedAt: createdAt,
        }),
      )
    } catch (error) {
      if (isUniqueViolation(error)) {
        this.logger.log(`通知去重：event=${sourceEventId} user=${userId}`)
        return
      }
      throw error
    }

    this.emitToUser(userId, {
      id,
      userId,
      organizationId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      read: false,
      createdAt,
      sourceEventId: sourceEventId ?? null,
    })
    this.logger.log(`Notification sent to user ${userId}: ${notification.title}`)
  }

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

  /** 从表读未读并推送。不标已读、不删除。 */
  async sendPendingNotifications(userId: string): Promise<void> {
    const pending = await this.listForUser(userId, undefined, false)
    if (pending.length === 0) return
    if (this.server) {
      for (const notification of pending) {
        this.server.to(`user:${userId}`).emit('notification', notification)
      }
    }
    this.logger.log(`Sent ${pending.length} pending notifications to user ${userId}`)
  }

  async markAsRead(userId: string, notificationId: string, organizationId?: string): Promise<boolean> {
    const repo = this.dataSource.getRepository(NotificationRecord)
    const result = await repo.update(
      {
        id: notificationId,
        userId,
        ...(organizationId ? { organizationId } : {}),
      },
      { read: true },
    )
    const updated = (result.affected ?? 0) > 0
    if (updated) {
      this.logger.log(`Notification ${notificationId} marked as read by user ${userId}`)
    }
    return updated
  }

  async listForUser(
    userId: string,
    organizationId: string | undefined,
    all: boolean,
  ): Promise<Notification[]> {
    if (!userId) return []
    const repo = this.dataSource.getRepository(NotificationRecord)
    const rows = await repo.find({
      where: {
        userId,
        ...(organizationId ? { organizationId } : {}),
        ...(all ? {} : { read: false }),
      },
      order: { createdAt: 'ASC', id: 'ASC' },
    })
    return rows.map((row) => this.toNotification(row))
  }

  private toNotification(row: NotificationRecord): Notification {
    return {
      id: row.id,
      userId: row.userId,
      organizationId: row.organizationId,
      type: row.type,
      title: row.title,
      message: row.body ?? '',
      data: row.metadata ?? undefined,
      read: row.read,
      createdAt: row.createdAt,
      sourceEventId: row.sourceEventId,
    }
  }

  private emitToUser(userId: string, notification: Notification): void {
    if (this.server) {
      this.server.to(`user:${userId}`).emit('notification', notification)
    }
  }
}
