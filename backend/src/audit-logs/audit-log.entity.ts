import {
  Entity,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
} from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'
import { Organization } from '../organizations/organization.entity'

@Entity('audit_logs')
@Index('idx_audit_log_resource_id', ['resourceId'])
@Index('idx_audit_log_action', ['action'])
@Index('idx_audit_log_actor', ['actor'])
@Index('idx_audit_log_timestamp', ['timestamp'])
@Index('idx_audit_log_organization', ['organizationId'])
export class AuditLog extends TenantAwareEntity {

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
