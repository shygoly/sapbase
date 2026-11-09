import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('announcement_audiences')
@Index(
  'UQ_announcement_audience',
  ['announcementId', 'audienceType', 'audienceValue'],
  { unique: true },
)
export class AnnouncementAudience extends TenantAwareEntity {
  @Column({ type: 'uuid' })
  announcementId: string

  @Column({ type: 'varchar', length: 32 })
  audienceType: 'role' | 'user' | 'scope_node' | 'scope_subtree'

  @Column({ type: 'varchar', length: 255 })
  audienceValue: string
}
