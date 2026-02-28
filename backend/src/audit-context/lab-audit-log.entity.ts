import { Entity, Column, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('lab_audit_logs')
@Index('idx_lab_audit_org', ['organizationId'])
@Index('idx_lab_audit_org_entity', ['organizationId', 'entityType', 'entityId'])
@Index('idx_lab_audit_org_action', ['organizationId', 'action'])
export class LabAuditLog extends TenantAwareEntity {
  @Column({ type: 'uuid', nullable: true })
  actorId: string | null

  @Column({ type: 'varchar', length: 100 })
  action: string

  @Column({ type: 'varchar', length: 100 })
  entityType: string

  @Column({ type: 'varchar', length: 100 })
  entityId: string

  @Column({ type: 'text', nullable: true })
  message: string | null

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null

  @Column({ type: 'varchar', length: 64 })
  digest: string

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  eventAt: Date
}
