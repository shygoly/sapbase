import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm'

@Entity('audit_logs')
@Index('idx_audit_log_resource_id', ['resourceId'])
@Index('idx_audit_log_action', ['action'])
@Index('idx_audit_log_actor', ['actor'])
@Index('idx_audit_log_timestamp', ['timestamp'])
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

  @Column({ type: 'uuid', nullable: true })
  resourceId?: string

  @Column({ type: 'jsonb', nullable: true })
  changes?: Record<string, any>

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>

  @CreateDateColumn()
  timestamp: Date
}
