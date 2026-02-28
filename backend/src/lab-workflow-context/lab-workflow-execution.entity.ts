import { Entity, Column, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

export enum LabWorkflowExecutionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('lab_workflow_executions')
@Index('idx_lab_workflow_org', ['organizationId'])
@Index('idx_lab_workflow_analyst', ['organizationId', 'assignedAnalystId'])
@Index('idx_lab_workflow_sample', ['organizationId', 'sampleId'])
export class LabWorkflowExecution extends TenantAwareEntity {
  @Column({ type: 'uuid' })
  sampleId: string

  @Column({ type: 'uuid' })
  methodId: string

  @Column({ type: 'int', default: 1 })
  currentStep: number

  @Column({ type: 'int', default: 1 })
  plannedSteps: number

  @Column({ type: 'varchar', length: 50, default: LabWorkflowExecutionStatus.PENDING })
  status: LabWorkflowExecutionStatus

  @Column({ type: 'uuid', nullable: true })
  assignedAnalystId: string | null

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, unknown> | null
}
