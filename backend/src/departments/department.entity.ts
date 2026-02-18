import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm'
import { User } from '../users/user.entity'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'
import { Organization } from '../organizations/organization.entity'

@Entity('departments')
@Index('idx_department_organization', ['organizationId'])
export class Department extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'text', nullable: true })
  description: string

  @Column({ type: 'uuid', nullable: true })
  managerId: string

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'managerId' })
  manager: User

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: 'active' | 'inactive'
}
