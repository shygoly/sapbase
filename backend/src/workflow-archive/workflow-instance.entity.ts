/**
 * 只读归档：旧工作流退场后仅用于 schema 基线与历史数据查询；不新增写入路径。
 * 表名与列与 schema-baseline 的 workflow_instances 一一对应。
 */
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
  entityType: string

  @Column({ type: 'varchar', length: 255 })
  entityId: string

  @Column({ type: 'varchar', length: 255 })
  currentState: string

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, any>

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
