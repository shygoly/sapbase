import { Entity, Column, ManyToOne } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { ModuleRegistry } from './module-registry.entity'

export enum CapabilityType {
  CRUD = 'crud',
  QUERY = 'query',
  ACTION = 'action',
  WORKFLOW = 'workflow',
}

@Entity('module_capabilities')
export class ModuleCapability extends BaseEntity {
  @ManyToOne(() => ModuleRegistry, { onDelete: 'CASCADE' })
  module: ModuleRegistry

  @Column()
  moduleId: string

  @Column({ type: 'varchar', length: 50 })
  capabilityType: CapabilityType

  @Column({ type: 'varchar', length: 255, nullable: true })
  entity: string

  @Column({ type: 'jsonb', default: [] })
  operations: string[]

  @Column({ type: 'jsonb', default: [] })
  apiEndpoints: string[]

  @Column({ type: 'text', nullable: true })
  description: string
}
