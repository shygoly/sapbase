import { Column, Entity, Index, Unique } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

export type MetricPeriod = 'hour' | 'day' | 'week' | 'month'
export type MetricAggregation = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'ratio' | 'distinct_count'
export type MetricSourceType = 'blueprint' | 'platform' | 'event' | 'computed'

@Entity('metric_definitions')
@Unique('UQ_metric_definition_org_key_version', ['organizationId', 'key', 'version'])
export class MetricDefinition extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'varchar', length: 128 }) key: string
  @Column({ type: 'varchar', length: 255 }) name: string
  @Column({ type: 'varchar', length: 16 }) period: MetricPeriod
  @Column({ type: 'varchar', length: 24 }) aggregation: MetricAggregation
  @Column({ type: 'varchar', length: 16 }) sourceType: MetricSourceType
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) sourceConfig: Record<string, unknown>
  @Column({ type: 'text', array: true, default: () => "'{}'::text[]" }) dimensions: string[]
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) filters: Record<string, unknown>
  @Column({ type: 'text', array: true, default: () => "'{}'::text[]" }) permissions: string[]
  @Column({ type: 'int', default: 1 }) version: number
  @Column({ type: 'varchar', length: 16, default: 'active' }) status: 'active' | 'inactive'
  @Column({ type: 'text', nullable: true }) description: string | null
}

@Entity('metric_values')
@Unique('UQ_metric_value_org_key_version_period_dims', [
  'organizationId',
  'metricKey',
  'metricVersion',
  'periodStart',
  'dimensionHash',
])
@Index('idx_metric_value_org_period', ['organizationId', 'metricKey', 'periodStart'])
export class MetricValue extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'varchar', length: 128 }) metricKey: string
  @Column({ type: 'int' }) metricVersion: number
  @Column({ type: 'timestamptz' }) periodStart: Date
  @Column({ type: 'timestamptz' }) periodEnd: Date
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) dimensions: Record<string, unknown>
  @Column({ type: 'varchar', length: 64 }) dimensionHash: string
  @Column({ type: 'numeric', precision: 20, scale: 4, default: 0 }) value: string
  @Column({ type: 'int', default: 0 }) sampleCount: number
  @Column({ type: 'text', array: true, default: () => "'{}'::text[]" }) scopeNodeIds: string[]
}

@Entity('dashboards')
@Unique('UQ_dashboard_org_key', ['organizationId', 'key'])
export class Dashboard extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'varchar', length: 128 }) key: string
  @Column({ type: 'varchar', length: 255 }) name: string
  @Column({ type: 'text', nullable: true }) description: string | null
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) visibility: Record<string, unknown>
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) defaultFilters: Record<string, unknown>
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) layout: unknown[]
  @Column({ type: 'varchar', length: 16, default: 'active' }) status: 'active' | 'inactive'
}

@Entity('dashboard_widgets')
@Index('idx_dashboard_widget_dashboard', ['dashboardId', 'order'])
export class DashboardWidget extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'uuid' }) dashboardId: string
  @Column({ type: 'varchar', length: 128 }) key: string
  @Column({ type: 'varchar', length: 16 }) type: 'number' | 'bar' | 'line' | 'pie' | 'ranking' | 'table'
  @Column({ type: 'varchar', length: 128 }) metricKey: string
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) config: Record<string, unknown>
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) layout: Record<string, unknown>
  @Column({ type: 'int', default: 0 }) order: number
}

@Entity('metric_alerts')
@Unique('UQ_metric_alert_org_key', ['organizationId', 'key'])
export class MetricAlert extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'varchar', length: 128 }) key: string
  @Column({ type: 'varchar', length: 128 }) metricKey: string
  @Column({ type: 'varchar', length: 16 }) operator: 'gt' | 'gte' | 'lt' | 'lte' | 'no_data'
  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true }) threshold: string | null
  @Column({ type: 'int', default: 30 }) windowMinutes: number
  @Column({ type: 'int', default: 30 }) frequencyMinutes: number
  @Column({ type: 'int', default: 60 }) cooldownMinutes: number
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) scope: Record<string, unknown>
  @Column({ type: 'text', array: true, default: () => "'{}'::text[]" }) channels: string[]
  @Column({ type: 'varchar', length: 16, default: 'active' }) status: 'active' | 'inactive'
  @Column({ type: 'timestamptz', nullable: true }) silenceUntil: Date | null
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown> | null
}

@Entity('metric_alert_events')
@Unique('UQ_metric_alert_event_dedup', ['alertId', 'dedupKey'])
@Index('idx_metric_alert_event_org_state', ['organizationId', 'state', 'createdAt'])
export class MetricAlertEvent extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'uuid' }) alertId: string
  @Column({ type: 'varchar', length: 16 }) state: 'firing' | 'resolved' | 'silenced'
  @Column({ type: 'numeric', precision: 20, scale: 4, nullable: true }) value: string | null
  @Column({ type: 'varchar', length: 128 }) dedupKey: string
  @Column({ type: 'timestamptz', nullable: true }) notifiedAt: Date | null
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown> | null
}
