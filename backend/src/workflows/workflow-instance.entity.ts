import { Entity, Column, ManyToOne, OneToMany, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'
import { WorkflowDefinition } from './workflow-definition.entity'
import { WorkflowHistory } from './workflow-history.entity'
import { User } from '../users/user.entity'

export enum WorkflowInstanceStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('workflow_instances')
@Index('idx_workflow_instance_organization', ['organizationId'])
@Index('idx_workflow_instance_entity', ['entityType', 'entityId'])
@Index('idx_workflow_instance_workflow', ['workflowDefinitionId'])
export class WorkflowInstance extends TenantAwareEntity {
  @ManyToOne(() => WorkflowDefinition, { nullable: false })
  workflowDefinition: WorkflowDefinition

  @Column()
  workflowDefinitionId: string

  @Column({ type: 'varchar', length: 255 })
  entityType: string // e.g., "Opportunity"

  @Column({ type: 'varchar', length: 255 })
  entityId: string // e.g., "opp-123"

  @Column({ type: 'varchar', length: 255 })
  currentState: string

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, any> // Workflow variables

  @Column({ type: 'varchar', length: 50, default: WorkflowInstanceStatus.RUNNING })
  status: WorkflowInstanceStatus

  @ManyToOne(() => User, { nullable: true })
  startedBy: User

  @Column({ nullable: true })
  startedById: string

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date

  @OneToMany(() => WorkflowHistory, (history) => history.workflowInstance)
  history: WorkflowHistory[]
}
