import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../../common/entities/tenant-aware.entity'

@Entity('scope_dimensions')
@Index('idx_scope_dimension_org_key', ['organizationId', 'key'], { unique: true })
@Index('idx_scope_dimension_org_status', ['organizationId', 'status'])
export class ScopeDimension extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 64 })
  key: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description: string | null

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, unknown> | null

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: 'active' | 'inactive'
}
