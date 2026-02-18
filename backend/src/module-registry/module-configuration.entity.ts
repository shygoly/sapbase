import { Entity, Column, ManyToOne } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { ModuleRegistry } from './module-registry.entity'

@Entity('module_configurations')
export class ModuleConfiguration extends BaseEntity {
  @ManyToOne(() => ModuleRegistry, { onDelete: 'CASCADE' })
  module: ModuleRegistry

  @Column()
  moduleId: string

  @Column({ type: 'varchar', length: 100 })
  configType: string // 'schema', 'usage', 'api', 'relationship'

  @Column({ type: 'jsonb', nullable: true })
  schema: Record<string, any>

  @Column({ type: 'text', nullable: true })
  documentation: string

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>
}
