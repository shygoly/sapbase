import { Entity, Column, ManyToOne, Index } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { WorkflowInstance } from './workflow-instance.entity'

/**
 * Audit log for AI-suggested transitions (Phase 6 auto/semi-auto job).
 * When strategy is "audit only", the job writes here instead of executing.
 */
@Entity('workflow_auto_suggestion_logs')
@Index('idx_auto_suggestion_instance', ['workflowInstanceId'])
@Index('idx_auto_suggestion_created', ['createdAt'])
export class WorkflowAutoSuggestionLog extends BaseEntity {
  @Column()
  workflowInstanceId: string

  @ManyToOne(() => WorkflowInstance, { onDelete: 'CASCADE' })
  workflowInstance: WorkflowInstance

  @Column()
  organizationId: string

  @Column({ type: 'varchar', length: 255 })
  suggestedToState: string

  @Column({ type: 'text', nullable: true })
  reason: string | null
}
