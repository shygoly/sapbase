import { Entity, Column, OneToMany, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'
import { WorkflowInstance } from './workflow-instance.entity'

export enum WorkflowStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DRAFT = 'draft',
}

export interface WorkflowState {
  name: string
  initial?: boolean
  final?: boolean
  metadata?: Record<string, any>
}

export interface WorkflowTransition {
  from: string
  to: string
  guard?: string // JavaScript expression for guard condition
  action?: string // Action hook identifier
  metadata?: Record<string, any>
}

@Entity('workflow_definitions')
@Index('idx_workflow_def_organization', ['organizationId'])
@Index('idx_workflow_def_entity_type', ['entityType'])
export class WorkflowDefinition extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description: string

  @Column({ type: 'varchar', length: 255 })
  entityType: string // e.g., "Opportunity", "Lead"

  @Column({ type: 'jsonb' })
  states: WorkflowState[]

  @Column({ type: 'jsonb' })
  transitions: WorkflowTransition[]

  @Column({ type: 'varchar', length: 50, default: WorkflowStatus.DRAFT })
  status: WorkflowStatus

  @Column({ type: 'varchar', length: 50, default: '1.0.0' })
  version: string

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>

  @OneToMany(() => WorkflowInstance, (instance) => instance.workflowDefinition)
  instances: WorkflowInstance[]
}
