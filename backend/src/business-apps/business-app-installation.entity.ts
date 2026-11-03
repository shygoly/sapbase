import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm'
import type {
  BusinessAppDeploymentProfile,
  BusinessAppLicenseBinding,
  BusinessAppStatus,
} from '@speckit/shared-schemas'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'
import { User } from '../users/user.entity'

@Entity('app_installations')
@Unique('uq_app_installations_organization_app_key', ['organizationId', 'appKey'])
@Unique('uq_app_installations_organization_slug', ['organizationId', 'slug'])
@Index('idx_app_installations_organization_status', ['organizationId', 'status'])
@Index('idx_app_installations_blueprint', ['blueprintId', 'blueprintVersion'])
export class BusinessAppInstallation extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 64 })
  appKey: string

  @Column({ type: 'varchar', length: 255 })
  displayName: string

  @Column({ type: 'varchar', length: 64 })
  slug: string

  @Column({ type: 'varchar', length: 64 })
  blueprintId: string

  @Column({ type: 'varchar', length: 32 })
  blueprintVersion: string

  @Column({ type: 'varchar', length: 71 })
  releaseDigest: string

  @Column({ type: 'varchar', length: 128 })
  runtimeRequirement: string

  @Column({ type: 'varchar', length: 32, default: 'shared-saas' })
  deploymentProfile: BusinessAppDeploymentProfile

  @Column({ type: 'varchar', length: 32, default: 'installing' })
  status: BusinessAppStatus

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  config: Record<string, unknown>

  @Column({ type: 'jsonb', nullable: true })
  license: BusinessAppLicenseBinding | null

  @Column({ type: 'uuid', nullable: true })
  currentRevisionId: string | null

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy?: User | null

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null
}
