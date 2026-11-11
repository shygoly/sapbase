import { Injectable, Logger, Optional } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { Server } from 'socket.io'
import { DataSource, IsNull } from 'typeorm'
import {
  NotificationRecord,
  type NotificationCategory,
  type NotificationPriority,
  type NotificationType,
} from '../../notifications/notification.entity'
import { NotificationPreferencesService } from '../../notifications/notification-preferences.service'
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
  category?: NotificationCategory
  priority?: NotificationPriority
  actionUrl?: string | null
  expiresAt?: Date | null
  readAt?: Date | null
  mandatory?: boolean
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

  constructor(
    private readonly dataSource: DataSource,
    @Optional() private readonly preferences?: NotificationPreferencesService,
  ) {}

  setServer(server: Server): void {
    this.server = server
  }

  setGetOrganizationUsers(fn: (organizationId: string) => string[]): void {
    this.getOrganizationUsers = fn
  }

  /**
   * 写表 +（若在线）WS 推送。
   * `sourceEventId` 可选：与 userId 组成 UNIQUE，重复投递不产生第二行。
   *
   * 偏好只影响“站内提示/WS 推送”，不影响站内持久化；mandatory 绕过 mute。
   */
  async sendToUser(
    userId: string,
    notification: SendNotificationInput,
    sourceEventId?: string,
  ): Promise<void> {
    await this.sendToUsers([userId], notification, sourceEventId)
  }

  /**
   * 批量投递：一次 INSERT ... ON CONFLICT DO NOTHING，再按偏好决定是否 WS 推送。
   * 大组织公告扇出按 100 人一批调用，避免逐用户 round-trip。
   */
  async sendToUsers(
    userIds: string[],
    notification: SendNotificationInput,
    sourceEventId?: string,
  ): Promise<void> {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))]
    if (uniqueUserIds.length === 0) return
    const organizationId = notification.organizationId
    if (!organizationId) {
      for (const userId of uniqueUserIds) {
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
      }
      this.logger.warn(`通知未持久化：缺少 organizationId，users=${uniqueUserIds.length}`)
      return
    }

    const createdAt = new Date()
    const rows = uniqueUserIds.map((userId) => ({
      id: randomUUID(),
      userId,
      organizationId,
      type: notification.type,
      title: notification.title,
      body: notification.message ?? null,
      read: false,
      sourceEventId: sourceEventId ?? null,
      metadata: notification.data ?? null,
      category: notification.category ?? 'system',
      priority: notification.priority ?? 'normal',
      actionUrl: notification.actionUrl ?? null,
      expiresAt: notification.expiresAt ?? null,
      readAt: null,
      mandatory: notification.mandatory ?? false,
      deletedAt: null,
      createdAt,
      updatedAt: createdAt,
    }))

    const repo = this.dataSource.getRepository(NotificationRecord)
    try {
      await repo
        .createQueryBuilder()
        .insert()
        .into(NotificationRecord)
        .values(rows as never)
        .orIgnore()
        .execute()
    } catch (error) {
      if (isUniqueViolation(error)) {
        this.logger.log(`通知去重：event=${sourceEventId} users=${uniqueUserIds.length}`)
        return
      }
      throw error
    }

    const preferences = this.preferences
      ? await this.preferences.resolveForUsers(
          organizationId,
          uniqueUserIds,
          notification.category ?? 'system',
          notification.mandatory ?? false,
        )
      : null

    let pushed = 0
    for (const row of rows) {
      const preference = preferences?.get(row.userId)
      if (preference && (preference.muted || !preference.inApp)) continue
      this.emitToUser(row.userId, {
        id: row.id,
        userId: row.userId,
        organizationId,
        type: row.type,
        title: row.title,
        message: row.body ?? '',
        data: row.metadata ?? undefined,
        read: false,
        createdAt,
        sourceEventId: row.sourceEventId,
        category: row.category,
        priority: row.priority,
        actionUrl: row.actionUrl,
        expiresAt: row.expiresAt,
        readAt: null,
        mandatory: row.mandatory,
      })
      pushed += 1
    }
    if (sourceEventId) {
      this.logger.log(
        `通知批量写入：event=${sourceEventId} users=${uniqueUserIds.length} pushed=${pushed}`,
      )
    } else {
      this.logger.log(`Notification sent to ${uniqueUserIds.length} user(s): ${notification.title}`)
    }
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
      { read: true, readAt: new Date() },
    )
    const updated = (result.affected ?? 0) > 0
    if (updated) {
      this.logger.log(`Notification ${notificationId} marked as read by user ${userId}`)
    }
    return updated
  }

  async publish(
    userId: string,
    notification: SendNotificationInput,
    sourceEventId?: string,
  ): Promise<void> {
    await this.sendToUser(userId, notification, sourceEventId)
  }

  async listForUser(
    userId: string,
    organizationId: string | undefined,
    all: boolean,
    filters: {
      category?: string
      priority?: string
      includeExpired?: boolean
    } = {},
  ): Promise<Notification[]> {
    if (!userId) return []
    const repo = this.dataSource.getRepository(NotificationRecord)
    if (!filters.category && !filters.priority && !filters.includeExpired) {
      const rows = await repo.find({
        where: {
          userId,
          ...(organizationId ? { organizationId } : {}),
          deletedAt: IsNull(),
          ...(all ? {} : { read: false }),
        },
        order: { createdAt: 'ASC', id: 'ASC' },
      })
      return rows.map((row) => this.toNotification(row))
    }
    const qb = repo.createQueryBuilder('n')
    qb.where('n.userId = :userId', { userId })
    if (organizationId) qb.andWhere('n.organizationId = :organizationId', { organizationId })
    if (!all) qb.andWhere('n.read = false')
    qb.andWhere('n.deletedAt IS NULL')
    if (filters.category) qb.andWhere('n.category = :category', { category: filters.category })
    if (filters.priority) qb.andWhere('n.priority = :priority', { priority: filters.priority })
    if (!filters.includeExpired) {
      qb.andWhere('(n.expiresAt IS NULL OR n.expiresAt > now())')
    }
    const rows = await qb.orderBy('n.createdAt', 'ASC').addOrderBy('n.id', 'ASC').getMany()
    return rows.map((row) => this.toNotification(row))
  }

  async unreadCount(userId: string, organizationId?: string): Promise<number> {
    if (!userId) return 0
    const repo = this.dataSource.getRepository(NotificationRecord)
    return repo.count({
      where: {
        userId,
        ...(organizationId ? { organizationId } : {}),
        read: false,
        deletedAt: IsNull(),
      },
    })
  }

  async markAllRead(userId: string, organizationId?: string): Promise<number> {
    if (!userId) return 0
    const repo = this.dataSource.getRepository(NotificationRecord)
    const result = await repo.update(
      {
        userId,
        ...(organizationId ? { organizationId } : {}),
        read: false,
        deletedAt: IsNull(),
      },
      { read: true, readAt: new Date() },
    )
    return result.affected ?? 0
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
      category: row.category,
      priority: row.priority,
      actionUrl: row.actionUrl,
      expiresAt: row.expiresAt,
      readAt: row.readAt,
      mandatory: row.mandatory,
    }
  }

  private emitToUser(userId: string, notification: Notification): void {
    if (this.server) {
      this.server.to(`user:${userId}`).emit('notification', notification)
    }
  }
}
