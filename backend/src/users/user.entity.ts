import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm'
import { UserStatus } from '@speckit/shared-schemas'
import { BaseEntity } from '../common/entities/base.entity'
import { Role } from '../roles/role.entity'
import { Department } from '../departments/department.entity'

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordHash: string

  @Column({ type: 'uuid', nullable: true })
  departmentId?: string

  @Column({ type: 'varchar', length: 50, default: UserStatus.ACTIVE })
  status: UserStatus

  @ManyToOne(() => Role, { nullable: true, eager: true })
  @JoinColumn({ name: 'roleId' })
  roleEntity?: Role

  @Column({ type: 'uuid', nullable: true })
  roleId?: string

  @ManyToOne(() => Department, { nullable: true, eager: true })
  @JoinColumn({ name: 'departmentId' })
  departmentEntity?: Department

  role?: string
  roleName?: string
  rolePermissions?: string[]
}
