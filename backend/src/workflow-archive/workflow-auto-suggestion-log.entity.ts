/**
 * 只读归档：旧工作流退场后仅用于 schema 基线与历史数据查询；不新增写入路径。
 * 表名与列与 schema-baseline 的 workflow_auto_suggestion_logs 一一对应。
 */
import { Entity, Column, ManyToOne, Index } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { WorkflowInstance } from './workflow-instance.entity'

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
