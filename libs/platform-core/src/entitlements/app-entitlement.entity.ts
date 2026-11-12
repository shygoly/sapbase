import { Column, Entity, Index, Unique } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

export type AppEntitlementStatus = 'active' | 'suspended' | 'expired'
export type AppEntitlementSource = 'plan' | 'manual'

@Entity('app_entitlements')
@Unique('uq_app_entitlements_organization_app_key', ['organizationId', 'appKey'])
@Index('idx_app_entitlements_organization_status', ['organizationId', 'status'])
export class AppEntitlement extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 64 })
  appKey: string

  @Column({ type: 'varchar', length: 50 })
  planName: string

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: AppEntitlementStatus

  @Column({ type: 'varchar', length: 16, default: 'plan' })
  source: AppEntitlementSource

  /** 计划配额快照；数值型，未知键忽略。 */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  limits: Record<string, number>

  @Column({ type: 'timestamptz', nullable: true })
  validFrom: Date | null

  @Column({ type: 'timestamptz', nullable: true })
  validTo: Date | null

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null
}
