import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm'
import { TenantAwareEntity } from '../../common/entities/tenant-aware.entity'
import { ScopeDimension } from './scope-dimension.entity'

@Entity('scope_nodes')
@Index('idx_scope_node_org_dimension_path', ['organizationId', 'dimensionId', 'path'], {
  unique: true,
})
@Index('idx_scope_node_org_dimension_parent', ['organizationId', 'dimensionId', 'parentId'])
export class ScopeNode extends TenantAwareEntity {
  @Column({ type: 'uuid' })
  dimensionId: string

  @ManyToOne(() => ScopeDimension, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dimensionId' })
  dimension: ScopeDimension

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null

  @ManyToOne(() => ScopeNode, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentId' })
  parent: ScopeNode | null

  @Column({ type: 'text' })
  path: string

  @Column({ type: 'int' })
  depth: number

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 128, nullable: true })
  code: string | null

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: 'active' | 'inactive'
}
