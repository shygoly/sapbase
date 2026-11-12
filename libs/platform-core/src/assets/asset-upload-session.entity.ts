import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('asset_upload_sessions')
@Index('idx_asset_upload_org_status', ['organizationId', 'status'])
@Index('UQ_asset_upload_object_key', ['organizationId', 'objectKey'], { unique: true })
export class AssetUploadSession extends TenantAwareEntity {
  @Column({ type: 'uuid' })
  userId: string

  @Column({ type: 'varchar', length: 512 })
  objectKey: string

  @Column({ type: 'varchar', length: 255 })
  originalName: string

  @Column({ type: 'varchar', length: 128 })
  mimeType: string

  @Column({ type: 'bigint' })
  expectedSize: string

  @Column({ type: 'varchar', length: 128, nullable: true })
  checksum: string | null

  @Column({ type: 'varchar', length: 32, default: 'uploading' })
  status: 'uploading' | 'completed' | 'aborted' | 'expired'

  @Column({ type: 'jsonb', nullable: true })
  parts: Array<{ partNumber: number; etag: string; size: number }> | null

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null

  @Column({ type: 'timestamptz' })
  expiresAt: Date

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null
}
