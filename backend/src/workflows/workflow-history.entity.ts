import { Entity, Column, ManyToOne, Index } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { WorkflowInstance } from './workflow-instance.entity'
import { User } from '../users/user.entity'

@Entity('workflow_history')
@Index('idx_workflow_history_instance', ['workflowInstanceId'])
@Index('idx_workflow_history_timestamp', ['timestamp'])
export class WorkflowHistory extends BaseEntity {
  @ManyToOne(() => WorkflowInstance, { nullable: false, onDelete: 'CASCADE' })
  workflowInstance: WorkflowInstance

  @Column()
  workflowInstanceId: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  fromState: string

  @Column({ type: 'varchar', length: 255 })
  toState: string

  @ManyToOne(() => User, { nullable: true })
  triggeredBy: User

  @Column({ nullable: true })
  triggeredById: string

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date

  @Column({ type: 'jsonb', nullable: true })
  guardResult: {
    passed: boolean
    expression?: string
    error?: string
  }

  @Column({ type: 'jsonb', nullable: true })
  actionResult: {
    executed: boolean
    action?: string
    error?: string
  }

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>
}
