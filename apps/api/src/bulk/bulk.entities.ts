import { Column, Entity, Index, Unique } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

export type ImportMode = 'atomic' | 'partial'
export type ImportRunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'partial'
  | 'failed'
  | 'cancelled'
export type ExportRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
export type ExportFormat = 'csv' | 'json' | 'xlsx' | 'md' | 'pdf'

@Entity('import_runs')
@Unique('UQ_import_run_org_idempotency', ['organizationId', 'idempotencyKey'])
@Index('idx_import_run_org_created', ['organizationId', 'createdAt'])
@Index('idx_import_run_org_status', ['organizationId', 'status'])
export class ImportRun extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'varchar', length: 128 }) resourceKey: string
  @Column({ type: 'varchar', length: 16, default: 'partial' }) mode: ImportMode
  @Column({ type: 'varchar', length: 16, default: 'queued' }) status: ImportRunStatus
  @Column({ type: 'varchar', length: 128, nullable: true }) idempotencyKey: string | null
  @Column({ type: 'varchar', length: 64, nullable: true }) format: string | null
  @Column({ type: 'varchar', length: 512, nullable: true }) objectKey: string | null
  @Column({ type: 'int', default: 0 }) rowCount: number
  @Column({ type: 'int', default: 0 }) successCount: number
  @Column({ type: 'int', default: 0 }) failureCount: number
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) mapping: Record<string, unknown>
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) errors: unknown[]
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) options: Record<string, unknown>
  @Column({ type: 'varchar', length: 255, nullable: true }) createdBy: string | null
  @Column({ type: 'text', nullable: true }) error: string | null
}

@Entity('export_runs')
@Index('idx_export_run_org_created', ['organizationId', 'createdAt'])
@Index('idx_export_run_org_status', ['organizationId', 'status'])
export class ExportRun extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'varchar', length: 128 }) resourceKey: string
  @Column({ type: 'varchar', length: 16 }) format: ExportFormat
  @Column({ type: 'varchar', length: 16, default: 'queued' }) status: ExportRunStatus
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) filters: Record<string, unknown>
  @Column({ type: 'text', array: true, default: () => "'{}'::text[]" }) fields: string[]
  @Column({ type: 'int', default: 0 }) rowCount: number
  @Column({ type: 'varchar', length: 512, nullable: true }) objectKey: string | null
  @Column({ type: 'uuid', nullable: true }) assetId: string | null
  @Column({ type: 'varchar', length: 128, nullable: true }) mimeType: string | null
  @Column({ type: 'timestamptz', nullable: true }) expiresAt: Date | null
  @Column({ type: 'varchar', length: 255, nullable: true }) createdBy: string | null
  @Column({ type: 'text', nullable: true }) error: string | null
}

@Entity('import_mappings')
@Unique('UQ_import_mapping_org_resource_name', ['organizationId', 'resourceKey', 'name'])
export class ImportMapping extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'varchar', length: 128 }) resourceKey: string
  @Column({ type: 'varchar', length: 128 }) name: string
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) mapping: Record<string, unknown>
  @Column({ type: 'varchar', length: 255, nullable: true }) createdBy: string | null
}
