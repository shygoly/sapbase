import { Column, Entity, Index, Unique } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

@Entity('offline_packages')
@Unique('UQ_offline_package_org_key_version', ['organizationId', 'key', 'version'])
export class OfflinePackage extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'varchar', length: 128 }) key: string
  @Column({ type: 'int', default: 1 }) version: number
  @Column({ type: 'varchar', length: 255 }) title: string
  @Column({ type: 'varchar', length: 16, default: 'draft' }) status:
    | 'draft'
    | 'published'
    | 'revoked'
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) manifest: Record<string, unknown>
  @Column({ type: 'text', nullable: true }) signature: string | null
  @Column({ type: 'timestamptz', nullable: true }) expiresAt: Date | null
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null
}

@Entity('offline_entitlements')
@Unique('UQ_offline_entitlement_user_device_package', ['organizationId', 'userId', 'deviceId', 'packageId'])
@Index('idx_offline_entitlement_org_user', ['organizationId', 'userId', 'status'])
export class OfflineEntitlement extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'uuid' }) packageId: string
  @Column({ type: 'uuid' }) userId: string
  @Column({ type: 'varchar', length: 128 }) deviceId: string
  @Column({ type: 'varchar', length: 16, default: 'active' }) status:
    | 'active'
    | 'revoked'
    | 'expired'
  @Column({ type: 'timestamptz' }) expiresAt: Date
  @Column({ type: 'uuid', nullable: true }) grantedBy: string | null
  @Column({ type: 'timestamptz', nullable: true }) revokedAt: Date | null
}

@Entity('offline_devices')
@Unique('UQ_offline_device_org_user_device', ['organizationId', 'userId', 'deviceId'])
@Index('idx_offline_device_org_user', ['organizationId', 'userId', 'status'])
export class OfflineDevice extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'uuid' }) userId: string
  @Column({ type: 'varchar', length: 128 }) deviceId: string
  @Column({ type: 'varchar', length: 128, nullable: true }) name: string | null
  @Column({ type: 'varchar', length: 16, default: 'active' }) status: 'active' | 'revoked'
  @Column({ type: 'timestamptz', nullable: true }) lastSeenAt: Date | null
}
