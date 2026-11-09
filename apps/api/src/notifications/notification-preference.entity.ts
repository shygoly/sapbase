import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'
import type { NotificationCategory } from './notification.entity'

@Entity('notification_preferences')
@Index('UQ_notification_pref_org_user_category', ['organizationId', 'userId', 'category'], {
  unique: true,
})
export class NotificationPreference extends TenantAwareEntity {
  @Column({ type: 'uuid' })
  userId: string

  @Column({ type: 'varchar', length: 32 })
  category: NotificationCategory | 'all'

  @Column({ type: 'boolean', default: true })
  inApp: boolean

  @Column({ type: 'boolean', default: true })
  email: boolean

  @Column({ type: 'boolean', default: false })
  push: boolean

  @Column({ type: 'timestamptz', nullable: true })
  mutedUntil: Date | null
}
