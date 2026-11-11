import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

export type AnnouncementStatus = 'draft' | 'scheduled' | 'published' | 'withdrawn' | 'expired'

@Entity('announcements')
@Index('idx_announcement_org_status', ['organizationId', 'status', 'publishAt'])
export class Announcement extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 255 })
  title: string

  @Column({ type: 'text' })
  body: string

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status: AnnouncementStatus

  @Column({ type: 'varchar', length: 32, default: 'all' })
  audienceType: 'all' | 'role' | 'user' | 'scope_node' | 'scope_subtree'

  @Column({ type: 'timestamptz', nullable: true })
  publishAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  withdrawnAt: Date | null

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null

  /** 公告保留天数：到期后只软删除，审计引用仍可追溯。 */
  @Column({ type: 'int', default: 30 })
  retentionDays: number

  /** 附件只存 https/http 链接与展示名，不存二进制。 */
  @Column({ type: 'jsonb', nullable: true })
  attachments: Array<{ name: string; url: string }> | null

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null
}
