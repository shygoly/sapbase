import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm'
import type {
  BusinessAppLicenseBinding,
  BusinessAppRevisionAction,
} from '@speckit/shared-schemas'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'
import { User } from '../users/user.entity'
import { BusinessAppInstallation } from './business-app-installation.entity'

@Entity('app_installation_revisions')
@Index('idx_app_installation_revisions_installation_created', [
  'appInstallationId',
  'createdAt',
])
@Index('idx_app_installation_revisions_organization', ['organizationId'])
export class BusinessAppInstallationRevision extends TenantAwareEntity {
  @ManyToOne(() => BusinessAppInstallation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appInstallationId' })
  appInstallation: BusinessAppInstallation

  @Column({ type: 'uuid' })
  appInstallationId: string

  @Column({ type: 'uuid', nullable: true })
  previousRevisionId: string | null

  @Column({ type: 'varchar', length: 128 })
  packageId: string

  @Column({ type: 'varchar', length: 64 })
  blueprintId: string

  @Column({ type: 'varchar', length: 32 })
  blueprintVersion: string

  @Column({ type: 'varchar', length: 71 })
  releaseDigest: string

  @Column({ type: 'varchar', length: 128 })
  runtimeRequirement: string

  @Column({ type: 'varchar', length: 32 })
  action: BusinessAppRevisionAction

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  config: Record<string, unknown>

  @Column({ type: 'jsonb', nullable: true })
  license: BusinessAppLicenseBinding | null

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy?: User | null

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null
}
