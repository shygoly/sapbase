import { Column, Entity, Index, Unique } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

export type BlueprintReleaseTrust = 'verified' | 'unsigned-dev' | 'legacy'

/**
 * 不可变 Blueprint 发布登记（2.2）。
 *
 * 同一组织 + blueprintId + version 只允许一个 releaseDigest；
 * 注册后不提供 update/delete API，安装通过 releaseId 绑定。
 */
@Entity('blueprint_releases')
@Unique('UQ_blueprint_releases_org_blueprint_version', [
  'organizationId',
  'blueprintId',
  'version',
])
@Index('idx_blueprint_releases_org_blueprint', [
  'organizationId',
  'blueprintId',
  'createdAt',
])
export class BlueprintRelease extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 64 })
  blueprintId: string

  @Column({ type: 'varchar', length: 32 })
  version: string

  @Column({ type: 'varchar', length: 128 })
  packageId: string

  @Column({ type: 'varchar', length: 71 })
  releaseDigest: string

  @Column({ type: 'varchar', length: 128 })
  runtimeRequirement: string

  @Column({ type: 'varchar', length: 32, default: 'verified' })
  trustStatus: BlueprintReleaseTrust

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  layers: Record<string, unknown>

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null
}
