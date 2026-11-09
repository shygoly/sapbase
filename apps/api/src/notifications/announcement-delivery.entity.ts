import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('announcement_deliveries')
@Index('UQ_announcement_delivery', ['announcementId', 'userId'], { unique: true })
@Index('idx_announcement_delivery_org_status', ['organizationId', 'status'])
export class AnnouncementDelivery extends TenantAwareEntity {
  @Column({ type: 'uuid' })
  announcementId: string

  @Column({ type: 'uuid' })
  userId: string

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: 'pending' | 'delivered' | 'read' | 'failed'

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  error: string | null
}
