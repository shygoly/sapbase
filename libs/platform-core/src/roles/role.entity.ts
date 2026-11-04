import { Entity, Column, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('roles')
@Index('idx_role_organization', ['organizationId'])
@Index('idx_role_organization_name', ['organizationId', 'name'], { unique: true })
export class Role extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description: string

  @Column({ type: 'simple-array', default: '' })
  permissions: string[]

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: 'active' | 'inactive'
}
