import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('review_comments')
@Index('idx_review_comment_approval', ['approvalId', 'createdAt'])
export class ReviewComment extends TenantAwareEntity {
  @Column({ type: 'uuid' }) approvalId: string
  @Column({ type: 'uuid' }) recordId: string
  @Column({ type: 'uuid', nullable: true }) authorId: string | null
  @Column({ type: 'text' }) body: string
  @Column({ type: 'uuid', nullable: true }) parentId: string | null
  @Column({ type: 'jsonb', nullable: true }) attachments: Array<Record<string, unknown>> | null
  @Column({ type: 'varchar', length: 16, default: 'all' }) visibility: 'all' | 'internal'
}
