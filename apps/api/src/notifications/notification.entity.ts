import { Column, Entity, Index, Unique } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'
export type NotificationCategory =
  | 'system'
  | 'approval'
  | 'announcement'
  | 'task'
  | 'security'
  | 'business'
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

@Entity('notifications')
@Unique('UQ_479a637eaa18f30ade2757e6afa', ['sourceEventId', 'userId'])
@Index('IDX_b055cfdba5009facbb972837dd', ['userId', 'read', 'createdAt'])
@Index('IDX_d4ab04c0b8e2d7435ec2357cce', ['organizationId', 'createdAt'])
export class NotificationRecord extends TenantAwareEntity {
  @Column({ type: 'uuid' })
  userId: string

  @Column()
  type: NotificationType

  @Column()
  title: string

  @Column({ type: 'text', nullable: true })
  body: string | null

  @Column({ type: 'boolean', default: false })
  read: boolean

  @Column({ type: 'uuid', nullable: true })
  sourceEventId: string | null

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null

  @Column({ type: 'varchar', length: 32, default: 'system' })
  category: NotificationCategory

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  priority: NotificationPriority

  @Column({ type: 'varchar', length: 1024, nullable: true })
  actionUrl: string | null

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null

  @Column({ type: 'boolean', default: false })
  mandatory: boolean
}
