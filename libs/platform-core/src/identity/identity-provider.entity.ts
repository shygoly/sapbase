import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('identity_providers')
@Index('UQ_identity_provider_org_key', ['organizationId', 'key'], { unique: true })
export class IdentityProvider extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 64 })
  key: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 16 })
  type: 'cas' | 'oauth2' | 'oidc' | 'saml'

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, unknown> | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  secretRef: string | null

  @Column({ type: 'varchar', length: 128, nullable: true })
  defaultRoleName: string | null

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: 'active' | 'inactive'
}
