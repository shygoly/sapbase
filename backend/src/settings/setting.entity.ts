import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm'
import { User } from '../users/user.entity'
import { BaseEntity } from '../common/entities/base.entity'

@Entity('settings')
@Index('idx_setting_user_id', ['userId'])
export class Setting extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User

  @Column({ type: 'varchar', length: 20, default: 'light' })
  theme: 'light' | 'dark'

  @Column({ type: 'varchar', length: 10, default: 'en' })
  language: string

  @Column({ type: 'varchar', length: 50, default: 'UTC' })
  timezone: string

  @Column({ type: 'varchar', length: 20, default: 'YYYY-MM-DD' })
  dateFormat: string

  @Column({ type: 'varchar', length: 20, default: 'HH:mm:ss' })
  timeFormat: string

  @Column({ type: 'int', default: 10 })
  pageSize: number

  @Column({ type: 'int', default: 14 })
  fontSize: number

  @Column({ type: 'boolean', default: true })
  enableNotifications: boolean
}
