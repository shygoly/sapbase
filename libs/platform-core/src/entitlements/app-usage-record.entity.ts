import { Column, Entity, Index } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

/**
 * 用量计量记录：只追加，不更新。
 *
 * `periodStart`/`periodEnd` 是 UTC 自然月；配额按月汇总。
 * `idempotencyKey` 用于重试去重（同组织内唯一）。
 */
@Entity('app_usage_records')
@Index('idx_app_usage_records_org_app_metric_period', [
  'organizationId',
  'appKey',
  'metric',
  'periodStart',
])
@Index('uq_app_usage_records_org_idempotency', ['organizationId', 'idempotencyKey'], {
  unique: true,
  where: '"idempotencyKey" IS NOT NULL',
})
export class AppUsageRecord extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 64 })
  appKey: string

  @Column({ type: 'varchar', length: 128 })
  metric: string

  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 })
  quantity: string

  @Column({ type: 'timestamptz' })
  periodStart: Date

  @Column({ type: 'timestamptz' })
  periodEnd: Date

  @Column({ type: 'varchar', length: 64 })
  source: string

  @Column({ type: 'varchar', length: 128, nullable: true })
  idempotencyKey: string | null

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null
}
