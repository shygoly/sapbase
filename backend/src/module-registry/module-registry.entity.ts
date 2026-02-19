import { Entity, Column, ManyToOne, OneToMany, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'
import { AIModel } from '../ai-models/ai-model.entity'
import { AIModule } from '../ai-modules/ai-module.entity'
import { User } from '../users/user.entity'
import { ModuleRelationship } from './module-relationship.entity'
import { ModuleCapability } from './module-capability.entity'
import { ModuleStatistics } from './module-statistics.entity'
import { ModuleConfiguration } from './module-configuration.entity'

export enum ModuleStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DEPRECATED = 'deprecated',
  ERROR = 'error',
}

export enum ModuleType {
  CRUD = 'crud',
  WORKFLOW = 'workflow',
  INTEGRATION = 'integration',
  REPORT = 'report',
  ANALYTICS = 'analytics',
}

@Entity('module_registry')
@Index('idx_module_registry_organization', ['organizationId'])
export class ModuleRegistry extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description: string

  @Column({ type: 'varchar', length: 50, default: ModuleType.CRUD })
  moduleType: ModuleType

  @ManyToOne(() => AIModel, { nullable: true })
  aiModel: AIModel

  @Column({ nullable: true })
  aiModelId: string

  @ManyToOne(() => User, { nullable: true })
  createdBy: User

  @Column({ nullable: true })
  createdById: string

  @Column({ type: 'varchar', length: 50, default: '1.0.0' })
  version: string

  @Column({ type: 'varchar', length: 50, default: ModuleStatus.ACTIVE })
  status: ModuleStatus

  @ManyToOne(() => AIModule, { nullable: true })
  aiModule: AIModule

  @Column({ nullable: true })
  aiModuleId: string

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    schemaPath?: string
    apiBasePath?: string
    entities?: string[]
    [key: string]: any
  }

  @OneToMany(() => ModuleRelationship, (rel) => rel.sourceModule)
  outgoingRelationships: ModuleRelationship[]

  @OneToMany(() => ModuleRelationship, (rel) => rel.targetModule)
  incomingRelationships: ModuleRelationship[]

  @OneToMany(() => ModuleCapability, (cap) => cap.module)
  capabilities: ModuleCapability[]

  @OneToMany(() => ModuleStatistics, (stat) => stat.module)
  statistics: ModuleStatistics[]

  @OneToMany(() => ModuleConfiguration, (config) => config.module)
  configurations: ModuleConfiguration[]
}
