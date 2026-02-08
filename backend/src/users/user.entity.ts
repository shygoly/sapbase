import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string

  @Column({ type: 'varchar', length: 255, default: 'user' })
  role: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  department: string

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: 'active' | 'inactive' | 'suspended'

  @Column({ type: 'simple-array', default: '' })
  permissions: string[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
