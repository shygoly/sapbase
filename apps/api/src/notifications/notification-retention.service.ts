import { Injectable, Logger, Optional } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { Announcement } from './announcement.entity'
import { AnnouncementDelivery } from './announcement-delivery.entity'
import { AnnouncementFanoutJobService } from './announcement-fanout-job.service'
import { AnnouncementsService } from './announcements.service'
import { NotificationRecord } from './notification.entity'
import { NotificationCleanupRun } from './notification-cleanup-run.entity'

export interface CleanupResult {
  organizationId: string
  notificationsDeleted: number
  deliveriesDeleted: number
  announcementsExpired: number
  announcementsDeleted: number
}

const NOTIFICATION_DELETE_BATCH = 500
const MAX_DELETE_BATCHES = 40
export const DEFAULT_NOTIFICATION_RETENTION_DAYS = 30

/**
 * 通知/公告保留期与定时发布。
 *
 * - 通知默认保留 30 天（`NOTIFICATION_RETENTION_DAYS`），过期或超期只写 `deletedAt`；
 * - 公告按 `retentionDays` 软删除，已发布公告先过期再清理；
 * - delivery 随公告软删除，未删除公告的投递统计保持不变；
 * - 每次清理写 `notification_cleanup_runs`（输入保留天数 + 输出计数）。
 */
@Injectable()
export class NotificationRetentionService {
  private readonly logger = new Logger(NotificationRetentionService.name)

  constructor(
    @InjectRepository(NotificationRecord)
    private readonly notifications: Repository<NotificationRecord>,
    @InjectRepository(Announcement)
    private readonly announcements: Repository<Announcement>,
    @InjectRepository(AnnouncementDelivery)
    private readonly deliveries: Repository<AnnouncementDelivery>,
    @InjectRepository(NotificationCleanupRun)
    private readonly runs: Repository<NotificationCleanupRun>,
    private readonly announcementsService: AnnouncementsService,
    @Optional() private readonly fanoutJob?: AnnouncementFanoutJobService,
    @Optional() private readonly dataSource?: DataSource,
  ) {
    // fanoutJob 通过模块实例化保证 job 类型已注册；这里只保留引用，避免被 tree-shake。
    void this.fanoutJob
  }

  @Cron('*/5 * * * *', { name: 'notifications.publish_scheduled' })
  async runScheduledPublish(): Promise<number> {
    const published = await this.announcementsService.publishDue(new Date())
    if (published > 0) {
      this.logger.log(`定时发布公告 ${published} 条`)
    }
    return published
  }

  @Cron('15 3 * * *', { name: 'notifications.cleanup_expired' })
  async runCleanup(): Promise<CleanupResult[]> {
    return this.cleanupAll(new Date())
  }

  async cleanupAll(
    now: Date = new Date(),
    notificationRetentionDays = this.retentionDays(),
  ): Promise<CleanupResult[]> {
    const rows: Array<{ organizationId: string }> = this.dataSource
      ? await this.dataSource.query(
          `SELECT DISTINCT "organizationId" FROM public.notifications
           UNION
           SELECT DISTINCT "organizationId" FROM public.announcements`,
        )
      : []
    const results: CleanupResult[] = []
    for (const row of rows) {
      try {
        results.push(
          await this.cleanupOrganization(row.organizationId, now, notificationRetentionDays),
        )
      } catch (error) {
        this.logger.error(
          `通知清理失败 organization=${row.organizationId}: ${(error as Error).message}`,
        )
      }
    }
    return results
  }

  async cleanupOrganization(
    organizationId: string,
    now: Date = new Date(),
    notificationRetentionDays = this.retentionDays(),
  ): Promise<CleanupResult> {
    const run = await this.runs.save(
      this.runs.create({
        organizationId,
        startedAt: now,
        finishedAt: null,
        status: 'running',
        notificationRetentionDays,
        notificationsDeleted: 0,
        deliveriesDeleted: 0,
        announcementsExpired: 0,
        announcementsDeleted: 0,
        error: null,
      }),
    )

    try {
      const expired = await this.expireAnnouncements(organizationId, now)
      const announcementsDeleted = await this.softDeleteAnnouncements(organizationId, now)
      const deliveriesDeleted = await this.softDeleteDeliveries(organizationId, now)
      const notificationsDeleted = await this.softDeleteNotifications(
        organizationId,
        now,
        notificationRetentionDays,
      )

      const result: CleanupResult = {
        organizationId,
        notificationsDeleted,
        deliveriesDeleted,
        announcementsExpired: expired,
        announcementsDeleted,
      }
      run.finishedAt = new Date()
      run.status = 'succeeded'
      run.notificationsDeleted = notificationsDeleted
      run.deliveriesDeleted = deliveriesDeleted
      run.announcementsExpired = expired
      run.announcementsDeleted = announcementsDeleted
      await this.runs.save(run)
      return result
    } catch (error) {
      run.finishedAt = new Date()
      run.status = 'failed'
      run.error = (error as Error).message.slice(0, 500)
      await this.runs.save(run)
      throw error
    }
  }

  private async expireAnnouncements(organizationId: string, now: Date): Promise<number> {
    const rows: Array<{ id: string }> = await this.notifications.manager.query(
      `UPDATE public.announcements
          SET status = 'expired', "updatedAt" = $2
        WHERE "organizationId" = $1
          AND "deletedAt" IS NULL
          AND status = 'published'
          AND "expiresAt" IS NOT NULL
          AND "expiresAt" <= $2
        RETURNING id`,
      [organizationId, now],
    )
    return rows.length
  }

  private async softDeleteAnnouncements(organizationId: string, now: Date): Promise<number> {
    const rows: Array<{ id: string }> = await this.notifications.manager.query(
      `UPDATE public.announcements
          SET "deletedAt" = $2, "updatedAt" = $2
        WHERE "organizationId" = $1
          AND "deletedAt" IS NULL
          AND status IN ('withdrawn', 'expired')
          AND "updatedAt" < ($2::timestamptz - "retentionDays" * interval '1 day')
        RETURNING id`,
      [organizationId, now],
    )
    return rows.length
  }

  private async softDeleteDeliveries(organizationId: string, now: Date): Promise<number> {
    const rows: Array<{ id: string }> = await this.notifications.manager.query(
      `UPDATE public.announcement_deliveries d
          SET "deletedAt" = $2, "updatedAt" = $2
        WHERE d."organizationId" = $1
          AND d."deletedAt" IS NULL
          AND EXISTS (
            SELECT 1 FROM public.announcements a
            WHERE a.id = d."announcementId"
              AND a."organizationId" = $1
              AND a."deletedAt" IS NOT NULL
          )
        RETURNING d.id`,
      [organizationId, now],
    )
    return rows.length
  }

  /**
   * 分批软删除：每批 500 行，最多 40 批，避免单次长事务锁住通知表。
   */
  private async softDeleteNotifications(
    organizationId: string,
    now: Date,
    retentionDays: number,
  ): Promise<number> {
    let deleted = 0
    for (let batch = 0; batch < MAX_DELETE_BATCHES; batch++) {
      const rows: Array<{ id: string }> = await this.notifications.manager.query(
        `UPDATE public.notifications
            SET "deletedAt" = $2, "updatedAt" = $2
          WHERE id IN (
            SELECT id FROM public.notifications
             WHERE "organizationId" = $1
               AND "deletedAt" IS NULL
               AND (
                 ("expiresAt" IS NOT NULL AND "expiresAt" <= $2)
                 OR "createdAt" < ($2::timestamptz - $3 * interval '1 day')
               )
             ORDER BY "createdAt" ASC
             LIMIT ${NOTIFICATION_DELETE_BATCH}
          )
          RETURNING id`,
        [organizationId, now, retentionDays],
      )
      deleted += rows.length
      if (rows.length < NOTIFICATION_DELETE_BATCH) break
    }
    return deleted
  }

  private retentionDays(): number {
    const value = Number(process.env.NOTIFICATION_RETENTION_DAYS)
    return Number.isFinite(value) && value >= 1 ? value : DEFAULT_NOTIFICATION_RETENTION_DAYS
  }
}
