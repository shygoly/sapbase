import { Entity, Column, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

export enum LabQaReviewDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
}

@Entity('lab_qa_reviews')
@Index('idx_lab_qa_review_org', ['organizationId'])
@Index('idx_lab_qa_review_submission', ['organizationId', 'submissionId'])
export class LabQaReview extends TenantAwareEntity {
  @Column({ type: 'uuid' })
  submissionId: string

  @Column({ type: 'uuid' })
  reviewerId: string

  @Column({ type: 'varchar', length: 50 })
  decision: LabQaReviewDecision

  @Column({ type: 'text', nullable: true })
  comments: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  signatureMethod: string | null

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  reviewedAt: Date
}
