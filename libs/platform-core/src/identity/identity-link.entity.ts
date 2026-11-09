import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('identity_links')
@Index('UQ_identity_link_provider_external', ['organizationId', 'providerId', 'externalId'], {
  unique: true,
})
export class IdentityLink extends TenantAwareEntity {
  @Column({ type: 'uuid' })
  providerId: string

  @Column({ type: 'varchar', length: 255 })
  externalId: string

  @Column({ type: 'uuid' })
  userId: string

  @Column({ type: 'jsonb', nullable: true })
  attributes: Record<string, unknown> | null

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null
}
