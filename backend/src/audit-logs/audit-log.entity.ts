import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm'

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  action: string

  @Column()
  resource: string

  @Column()
  actor: string

  @Column({ type: 'varchar', length: 50 })
  status: 'success' | 'failure' | 'pending'

  @CreateDateColumn()
  timestamp: Date
}
