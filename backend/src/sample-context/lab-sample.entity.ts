import { Entity, Column, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

export enum LabSampleStatus {
  RECEIVED = 'Received',
  IN_ANALYSIS = 'InAnalysis',
  IN_REVIEW = 'InReview',
  REPORTING = 'Reporting',
  ARCHIVED = 'Archived',
}

@Entity('lab_samples')
@Index('idx_lab_sample_org', ['organizationId'])
@Index('idx_lab_sample_code_org', ['organizationId', 'sampleCode'], { unique: true })
@Index('idx_lab_sample_status_org', ['organizationId', 'status'])
export class LabSample extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 100 })
  sampleCode: string

  @Column({ type: 'varchar', length: 100, nullable: true })
  customerCode: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  projectCode: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  batchNumber: string | null

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  sampleType: string | null

  @Column({ type: 'int', default: 0 })
  quantity: number

  @Column({ type: 'varchar', length: 50, default: LabSampleStatus.RECEIVED })
  status: LabSampleStatus

  @Column({ type: 'uuid', nullable: true })
  assignedAnalystId: string | null

  @Column({ type: 'uuid', nullable: true })
  assignedMethodId: string | null

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null
}
