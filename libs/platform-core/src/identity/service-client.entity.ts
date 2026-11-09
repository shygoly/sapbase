import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('service_clients')
@Index('UQ_service_client_org_key', ['organizationId', 'key'], { unique: true })
export class ServiceClient extends TenantAwareEntity {
  @Column({ type: 'uuid', nullable: true })
  appInstallationId: string | null

  @Column({ type: 'varchar', length: 128 })
  key: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 255, select: false })
  secretHash: string

  @Column({ type: 'jsonb', nullable: true })
  scopes: string[] | null

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: 'active' | 'inactive'

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null

  @Column({ type: 'jsonb', nullable: true })
  ipAllowlist: string[] | null
}
