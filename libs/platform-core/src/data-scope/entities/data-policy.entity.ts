import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../../common/entities/tenant-aware.entity'
import type { ScopeSpec, ScopeSubject } from '../data-scope.types'

@Entity('data_policies')
@Index('idx_data_policy_org_resource_status', ['organizationId', 'resourceKey', 'status'])
@Index('idx_data_policy_org_effect', ['organizationId', 'effect'])
export class DataPolicy extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'jsonb' })
  subject: ScopeSubject

  @Column({ type: 'varchar', length: 255 })
  resourceKey: string

  @Column({ type: 'jsonb' })
  actions: string[]

  @Column({ type: 'varchar', length: 8, default: 'allow' })
  effect: 'allow' | 'deny'

  @Column({ type: 'jsonb' })
  scope: ScopeSpec

  @Column({ type: 'int', default: 0 })
  priority: number

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: 'active' | 'inactive'

  @Column({ type: 'int', default: 1 })
  version: number
}
