import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('review_delegations')
@Index('idx_review_delegation_approval', ['approvalId', 'status'])
export class ReviewDelegation extends TenantAwareEntity {
  @Column({ type: 'uuid' }) approvalId: string
  @Column({ type: 'uuid' }) fromUserId: string
  @Column({ type: 'uuid' }) toUserId: string
  @Column({ type: 'varchar', length: 512, nullable: true }) reason: string | null
  @Column({ type: 'timestamptz', nullable: true }) validFrom: Date | null
  @Column({ type: 'timestamptz', nullable: true }) validTo: Date | null
  @Column({ type: 'varchar', length: 32, default: 'active' }) status: 'active' | 'revoked'
}
