import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('asset_variants')
@Index('idx_asset_variant_org_asset', ['organizationId', 'assetId'])
@Index('UQ_asset_variant_asset_kind', ['assetId', 'kind'], { unique: true })
export class AssetVariant extends TenantAwareEntity {
  @Column({ type: 'uuid' })
  assetId: string

  @Column({ type: 'varchar', length: 32 })
  kind: string

  @Column({ type: 'varchar', length: 32, default: 'local' })
  provider: string

  @Column({ type: 'varchar', length: 16, default: 'ready' })
  status: string

  @Column({ type: 'varchar', length: 512 })
  objectKey: string

  @Column({ type: 'varchar', length: 128 })
  mimeType: string

  @Column({ type: 'bigint' })
  size: string

  @Column({ type: 'int', nullable: true })
  width: number | null

  @Column({ type: 'int', nullable: true })
  height: number | null

  @Column({ type: 'int', nullable: true })
  bitrate: number | null

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null
}
