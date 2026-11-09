import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('review_events')
@Index('idx_review_event_approval', ['approvalId', 'createdAt'])
export class ReviewEvent extends TenantAwareEntity {
  @Column({ type: 'uuid' }) approvalId: string
  @Column({ type: 'uuid' }) recordId: string
  @Column({ type: 'varchar', length: 32 }) type: string
  @Column({ type: 'uuid', nullable: true }) actorId: string | null
  @Column({ type: 'jsonb', nullable: true }) payload: Record<string, unknown> | null
}
