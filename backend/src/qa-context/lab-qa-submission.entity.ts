import { Entity, Column, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

export enum LabQaSubmissionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('lab_qa_submissions')
@Index('idx_lab_qa_submission_org', ['organizationId'])
@Index('idx_lab_qa_submission_status', ['organizationId', 'status'])
export class LabQaSubmission extends TenantAwareEntity {
  @Column({ type: 'uuid' })
  sampleId: string

  @Column({ type: 'uuid' })
  methodId: string

  @Column({ type: 'uuid' })
  workflowExecutionId: string

  @Column({ type: 'uuid' })
  submittedById: string

  @Column({ type: 'varchar', length: 50, default: LabQaSubmissionStatus.PENDING })
  status: LabQaSubmissionStatus

  @Column({ type: 'text', nullable: true })
  submissionComment: string | null

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  submittedAt: Date
}
