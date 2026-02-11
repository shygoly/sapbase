import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm'
import { User } from '../users/user.entity'
import { BaseEntity } from '../common/entities/base.entity'

@Entity('departments')
export class Department extends BaseEntity {
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
