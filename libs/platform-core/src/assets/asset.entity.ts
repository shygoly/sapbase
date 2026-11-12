import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

export type AssetKind = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other'
export type AssetScanStatus = 'pending' | 'clean' | 'infected' | 'error' | 'skipped'
export type AssetStatus =
  | 'uploading'
  | 'scanning'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'quarantined'
  | 'deleted'

@Entity('assets')
@Index('idx_asset_org_status_created', ['organizationId', 'status', 'createdAt'])
@Index('idx_asset_org_checksum', ['organizationId', 'checksum'])
@Index('UQ_asset_org_object_key', ['organizationId', 'objectKey'], { unique: true })
export class Asset extends TenantAwareEntity {
  @Column({ type: 'uuid', nullable: true })
  appInstallationId: string | null

  @Column({ type: 'uuid', nullable: true })
  ownerId: string | null

  @Column({ type: 'varchar', length: 32, default: 'other' })
  kind: AssetKind

  @Column({ type: 'varchar', length: 32, default: 'uploading' })
  status: AssetStatus

  @Column({ type: 'varchar', length: 32, default: 'local' })
  provider: string

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  scanStatus: AssetScanStatus

  @Column({ type: 'varchar', length: 512 })
  objectKey: string

  @Column({ type: 'varchar', length: 255 })
  originalName: string

  @Column({ type: 'varchar', length: 128 })
  mimeType: string

  @Column({ type: 'bigint' })
  size: string

  @Column({ type: 'varchar', length: 128, nullable: true })
  checksum: string | null

  @Column({ type: 'int', nullable: true })
  width: number | null

  @Column({ type: 'int', nullable: true })
  height: number | null

  @Column({ type: 'int', nullable: true })
  durationMs: number | null

  @Column({ type: 'int', nullable: true })
  pageCount: number | null

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  tags: string[]

  @Column({ type: 'boolean', default: false })
  isPublic: boolean

  @Column({ type: 'timestamptz', nullable: true })
  retentionUntil: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null
}
