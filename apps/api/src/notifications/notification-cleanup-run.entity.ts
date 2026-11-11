import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

export type NotificationCleanupStatus = 'running' | 'succeeded' | 'failed'

/**
 * 清理审计：每次保留期 job 的输入（保留天数）与输出（软删除/过期数量）。
 * 只记录计数，不复制通知正文；通知本身按 deletedAt 软删除。
 */
@Entity('notification_cleanup_runs')
@Index('idx_notification_cleanup_run_org_started', ['organizationId', 'startedAt'])
export class NotificationCleanupRun extends TenantAwareEntity {
  @Column({ type: 'timestamptz' })
  startedAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null

  @Column({ type: 'varchar', length: 16, default: 'running' })
  status: NotificationCleanupStatus

  @Column({ type: 'int', default: 30 })
  notificationRetentionDays: number

  @Column({ type: 'int', default: 0 })
  notificationsDeleted: number

  @Column({ type: 'int', default: 0 })
  deliveriesDeleted: number

  @Column({ type: 'int', default: 0 })
  announcementsExpired: number

  @Column({ type: 'int', default: 0 })
  announcementsDeleted: number

  @Column({ type: 'varchar', length: 500, nullable: true })
  error: string | null
}
