import { Column, Entity } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('audit_archives')
export class AuditArchive extends TenantAwareEntity {
  @Column({ type: 'bigint' })
  fromSeq: string

  @Column({ type: 'bigint' })
  toSeq: string

  @Column({ type: 'varchar', length: 512, nullable: true })
  objectKey: string | null

  @Column({ type: 'jsonb', nullable: true })
  manifest: Record<string, unknown> | null

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: 'pending' | 'archived' | 'failed'
}
