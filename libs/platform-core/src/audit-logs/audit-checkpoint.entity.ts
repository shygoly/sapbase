import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('audit_checkpoints')
@Index('UQ_audit_checkpoint_org_seq', ['organizationId', 'seq'], { unique: true })
export class AuditCheckpoint extends TenantAwareEntity {
  @Column({ type: 'bigint' })
  seq: string

  @Column({ type: 'varchar', length: 128 })
  hash: string

  @Column({ type: 'varchar', length: 512, nullable: true })
  signature: string | null

  @Column({ type: 'varchar', length: 128, nullable: true })
  signer: string | null

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null
}
