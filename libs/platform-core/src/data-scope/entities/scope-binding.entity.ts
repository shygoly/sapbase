import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../../common/entities/tenant-aware.entity'
import type { RelationSpec } from '../data-scope.types'

@Entity('scope_bindings')
@Index(
  'idx_scope_binding_org_resource_dimension_kind',
  ['organizationId', 'resourceKey', 'dimensionKey', 'kind'],
  { unique: true },
)
export class ScopeBinding extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 255 })
  resourceKey: string

  @Column({ type: 'varchar', length: 64 })
  dimensionKey: string

  @Column({ type: 'varchar', length: 16 })
  kind: 'field' | 'owner' | 'relation'

  @Column({ type: 'varchar', length: 128, nullable: true })
  field: string | null

  @Column({ type: 'jsonb', nullable: true })
  relation: RelationSpec | null

  @Column({ type: 'boolean', default: true })
  writable: boolean
}
