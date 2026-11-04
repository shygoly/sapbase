import { Entity, Column, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('permissions')
@Index('idx_permission_organization', ['organizationId'])
@Index('idx_permission_organization_name', ['organizationId', 'name'], { unique: true })
export class Permission extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description: string

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: 'active' | 'inactive'
}
