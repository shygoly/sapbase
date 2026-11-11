import { Column, Entity, Index, Unique } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('record_snapshots')
@Unique('UQ_record_snapshot_record_version', ['recordId', 'version'])
@Index('idx_record_snapshot_org_record', ['organizationId', 'recordId', 'version'])
export class RecordSnapshot extends TenantAwareEntity {
  @Column() blueprintId: string
  @Column() entity: string
  @Column({ type: 'uuid' }) recordId: string
  @Column({ type: 'int' }) version: number
  @Column({ type: 'varchar', length: 64, nullable: true }) label: string | null
  @Column({ type: 'jsonb' }) data: Record<string, unknown>
  @Column({ type: 'varchar', nullable: true }) state: string | null
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null
  @Column({ type: 'text', nullable: true }) reason: string | null
  @Column({ type: 'boolean', default: false }) published: boolean
}
