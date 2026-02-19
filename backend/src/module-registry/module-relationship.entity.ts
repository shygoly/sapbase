import { Entity, Column, ManyToOne } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { ModuleRegistry } from './module-registry.entity'

export enum RelationshipType {
  DEPENDENCY = 'dependency',
  INTEGRATION = 'integration',
  DATA_FLOW = 'data-flow',
  HIERARCHICAL = 'hierarchical',
}

@Entity('module_relationships')
export class ModuleRelationship extends BaseEntity {
  @ManyToOne(() => ModuleRegistry, { onDelete: 'CASCADE' })
  sourceModule: ModuleRegistry

  @Column()
  sourceModuleId: string

  @ManyToOne(() => ModuleRegistry, { onDelete: 'CASCADE' })
  targetModule: ModuleRegistry

  @Column()
  targetModuleId: string

  @Column({ type: 'varchar', length: 50 })
  relationshipType: RelationshipType

  @Column({ type: 'text', nullable: true })
  description: string

  @Column({ type: 'jsonb', nullable: true })
  configuration: Record<string, any>
}
