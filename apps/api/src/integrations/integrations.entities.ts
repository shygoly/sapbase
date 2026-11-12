import { Column, Entity, Index, Unique } from 'typeorm'
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity'

export type ConnectorType = 'rest' | 'webhook' | 'database'
export type ConnectorStatus = 'active' | 'disabled'
export type OutboundStatus = 'queued' | 'sending' | 'succeeded' | 'failed' | 'dead'
export type WebhookEventStatus = 'received' | 'processed' | 'failed' | 'duplicate' | 'dead'
export type DataSourceStatus = 'active' | 'disabled'
export type SyncMode = 'full' | 'incremental'
export type SyncStatus = 'queued' | 'running' | 'succeeded' | 'partial' | 'failed' | 'cancelled'

@Entity('integration_connectors')
@Unique('UQ_integration_connector_org_key', ['organizationId', 'key'])
@Index('idx_integration_connector_org_type', ['organizationId', 'type'])
export class IntegrationConnector extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'uuid', nullable: true }) appInstallationId: string | null
  @Column({ type: 'varchar', length: 128 }) key: string
  @Column({ type: 'varchar', length: 255 }) name: string
  @Column({ type: 'varchar', length: 16 }) type: ConnectorType
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) config: Record<string, unknown>
  @Column({ type: 'varchar', length: 255, nullable: true }) secretRef: string | null
  @Column({ type: 'varchar', length: 16, default: 'active' }) status: ConnectorStatus
  @Column({ type: 'int', default: 1 }) version: number
  @Column({ type: 'timestamptz', nullable: true }) lastTestedAt: Date | null
  @Column({ type: 'varchar', length: 32, nullable: true }) lastTestStatus: string | null
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown> | null
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null
}

@Entity('outbound_messages')
@Unique('UQ_outbound_message_org_idempotency', ['organizationId', 'idempotencyKey'])
@Index('idx_outbound_message_org_status', ['organizationId', 'status', 'createdAt'])
export class OutboundMessage extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'uuid' }) connectorId: string
  @Column({ type: 'varchar', length: 128 }) eventType: string
  @Column({ type: 'jsonb' }) payload: Record<string, unknown>
  @Column({ type: 'varchar', length: 128 }) idempotencyKey: string
  @Column({ type: 'varchar', length: 16, default: 'queued' }) status: OutboundStatus
  @Column({ type: 'int', default: 0 }) attempts: number
  @Column({ type: 'int', default: 5 }) maxAttempts: number
  @Column({ type: 'text', nullable: true }) lastError: string | null
  @Column({ type: 'int', nullable: true }) responseStatus: number | null
  @Column({ type: 'text', nullable: true }) responseBody: string | null
  @Column({ type: 'timestamptz', nullable: true }) nextAttemptAt: Date | null
  @Column({ type: 'timestamptz', nullable: true }) deadAt: Date | null
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null
}

@Entity('webhook_endpoints')
@Unique('UQ_webhook_endpoint_org_key', ['organizationId', 'key'])
export class WebhookEndpoint extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'varchar', length: 128 }) key: string
  @Column({ type: 'varchar', length: 255 }) name: string
  @Column({ type: 'varchar', length: 255 }) secretRef: string
  @Column({ type: 'varchar', length: 128, default: '*' }) eventType: string
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) mapping: Record<string, unknown>
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) allowedIps: string[]
  @Column({ type: 'varchar', length: 16, default: 'active' }) status: ConnectorStatus
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null
}

@Entity('webhook_events')
@Unique('UQ_webhook_event_endpoint_event', ['endpointId', 'eventId'])
@Index('idx_webhook_event_org_status', ['organizationId', 'status', 'receivedAt'])
export class WebhookEvent extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'uuid' }) endpointId: string
  @Column({ type: 'varchar', length: 128 }) eventId: string
  @Column({ type: 'varchar', length: 128 }) payloadHash: string
  @Column({ type: 'jsonb' }) payload: Record<string, unknown>
  @Column({ type: 'varchar', length: 16, default: 'received' }) status: WebhookEventStatus
  @Column({ type: 'text', nullable: true }) error: string | null
  @Column({ type: 'timestamptz', default: () => 'now()' }) receivedAt: Date
  @Column({ type: 'timestamptz', nullable: true }) processedAt: Date | null
}

@Entity('data_sources')
@Unique('UQ_data_source_org_key', ['organizationId', 'key'])
export class DataSource extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'varchar', length: 128 }) key: string
  @Column({ type: 'varchar', length: 255 }) name: string
  @Column({ type: 'varchar', length: 16 }) dbType: 'postgres' | 'mysql' | 'mssql' | 'oracle'
  @Column({ type: 'varchar', length: 255 }) host: string
  @Column({ type: 'int', default: 5432 }) port: number
  @Column({ type: 'varchar', length: 128 }) database: string
  @Column({ type: 'boolean', default: true }) ssl: boolean
  @Column({ type: 'varchar', length: 255 }) secretRef: string
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) allowlist: string[]
  @Column({ type: 'varchar', length: 16, default: 'active' }) status: DataSourceStatus
  @Column({ type: 'timestamptz', nullable: true }) lastTestedAt: Date | null
  @Column({ type: 'varchar', length: 32, nullable: true }) lastTestStatus: string | null
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null
}

@Entity('data_sync_jobs')
@Unique('UQ_data_sync_job_org_key', ['organizationId', 'key'])
export class DataSyncJob extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'uuid' }) dataSourceId: string
  @Column({ type: 'varchar', length: 128 }) key: string
  @Column({ type: 'varchar', length: 255 }) name: string
  @Column({ type: 'varchar', length: 64 }) queryTemplate: string
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) queryParams: Record<string, unknown>
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) fieldMapping: Record<string, unknown>
  @Column({ type: 'varchar', length: 128 }) targetResourceKey: string
  @Column({ type: 'varchar', length: 16, default: 'incremental' }) mode: SyncMode
  @Column({ type: 'varchar', length: 64, nullable: true }) cursorField: string | null
  @Column({ type: 'varchar', length: 255, nullable: true }) watermark: string | null
  @Column({ type: 'int', default: 500 }) batchSize: number
  @Column({ type: 'varchar', length: 64, nullable: true }) schedule: string | null
  @Column({ type: 'varchar', length: 16, default: 'active' }) status: 'active' | 'disabled'
  @Column({ type: 'timestamptz', nullable: true }) lastRunAt: Date | null
  @Column({ type: 'uuid', nullable: true }) createdBy: string | null
}

@Entity('data_sync_runs')
@Index('idx_data_sync_run_org_job', ['organizationId', 'jobId', 'createdAt'])
export class DataSyncRun extends TenantAwareEntity {
  @Column({ type: 'uuid' }) organizationId: string
  @Column({ type: 'uuid' }) jobId: string
  @Column({ type: 'varchar', length: 16, default: 'queued' }) status: SyncStatus
  @Column({ type: 'int', default: 0 }) rowsRead: number
  @Column({ type: 'int', default: 0 }) rowsWritten: number
  @Column({ type: 'int', default: 0 }) rowsFailed: number
  @Column({ type: 'varchar', length: 255, nullable: true }) watermarkBefore: string | null
  @Column({ type: 'varchar', length: 255, nullable: true }) watermarkAfter: string | null
  @Column({ type: 'jsonb', nullable: true }) diff: Record<string, unknown> | null
  @Column({ type: 'text', nullable: true }) error: string | null
  @Column({ type: 'uuid', nullable: true }) importRunId: string | null
  @Column({ type: 'timestamptz', nullable: true }) startedAt: Date | null
  @Column({ type: 'timestamptz', nullable: true }) finishedAt: Date | null
}
