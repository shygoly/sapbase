import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('record_operations')
@Index('UQ_record_operation_org_idem', ['organizationId', 'idempotencyKey'], {
  unique: true,
  where: `"idempotencyKey" IS NOT NULL`,
})
export class RecordOperation extends TenantAwareEntity {
  @Column() blueprintId: string
  @Column() entity: string
  @Column({ type: 'uuid', nullable: true }) recordId: string | null
  @Column({ type: 'varchar', length: 32 }) type: string
  @Column({ type: 'varchar', length: 128, nullable: true }) idempotencyKey: string | null
  @Column({ type: 'varchar', length: 16, default: 'succeeded' }) status:
    | 'succeeded'
    | 'failed'
  @Column({ type: 'jsonb', nullable: true }) before: Record<string, unknown> | null
  @Column({ type: 'jsonb', nullable: true }) after: Record<string, unknown> | null
  @Column({ type: 'varchar', length: 255, nullable: true }) createdBy: string | null
  @Column({ type: 'text', nullable: true }) error: string | null
}
