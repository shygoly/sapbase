import { Entity, Column } from 'typeorm'
import { UserStatus } from '@speckit/shared-schemas'
import { BaseEntity } from '../common/entities/base.entity'

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordHash: string

  @Column({ type: 'varchar', length: 255, default: 'user' })
  role: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  department: string

  @Column({ type: 'varchar', length: 50, default: UserStatus.ACTIVE })
  status: UserStatus

  @Column({ type: 'simple-array', default: '' })
  permissions: string[]
}
