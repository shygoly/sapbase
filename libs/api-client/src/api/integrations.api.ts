import { httpClient } from './client'

export interface IntegrationConnector {
  id: string
  key: string
  name: string
  type: 'rest' | 'webhook' | 'database'
  config: Record<string, unknown>
  secretRef: string | null
  status: 'active' | 'disabled'
  version: number
  lastTestStatus: string | null
}

export interface OutboundMessage {
  id: string
  connectorId: string
  eventType: string
  status: 'queued' | 'sending' | 'succeeded' | 'failed' | 'dead'
  attempts: number
  responseStatus: number | null
  lastError: string | null
  createdAt: string
}

export interface WebhookEndpoint {
  id: string
  key: string
  name: string
  eventType: string
  status: string
}

export interface WebhookEvent {
  id: string
  eventId: string
  status: string
  error: string | null
  receivedAt: string
}

export interface DataSource {
  id: string
  key: string
  name: string
  dbType: string
  host: string
  database: string
  status: string
  lastTestStatus: string | null
}

export interface SyncJob {
  id: string
  key: string
  name: string
  targetResourceKey: string
  mode: 'full' | 'incremental'
  watermark: string | null
  status: string
}

export interface SyncRun {
  id: string
  jobId: string
  status: string
  rowsRead: number
  rowsWritten: number
  rowsFailed: number
  diff: Record<string, unknown> | null
  error: string | null
}

export interface IntegrationMetrics {
  outbound: {
    total: number
    succeeded: number
    dead: number
    successRate: number
    byStatus: Array<{ status: string; count: number; avgAttempts: string }>
  }
  sync: {
    byStatus: Array<{ status: string; count: number; rowsRead: number; rowsWritten: number; rowsFailed: number }>
    rowsRead: number
    rowsWritten: number
    rowsFailed: number
  }
}

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as Record<string, unknown> | T
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: T }).data
  return body as T
}

export const integrationsApi = {
  async connectors(): Promise<IntegrationConnector[]> {
    return unwrap(await httpClient.get('/api/integrations/connectors'))
  },
  async createConnector(input: {
    key: string
    name: string
    type: 'rest' | 'webhook' | 'database'
    config: Record<string, unknown>
    secretRef?: string
  }): Promise<IntegrationConnector> {
    return unwrap(await httpClient.post('/api/integrations/connectors', input))
  },
  async testConnector(id: string) {
    return unwrap(await httpClient.post(`/api/integrations/connectors/${id}/test`, {}))
  },
  async disableConnector(id: string) {
    return unwrap(await httpClient.delete(`/api/integrations/connectors/${id}`))
  },
  async outbound(status?: string): Promise<OutboundMessage[]> {
    return unwrap(await httpClient.get('/api/integrations/outbound', { params: { status } }))
  },
  async enqueue(connectorId: string, input: {
    eventType: string
    payload: Record<string, unknown>
    idempotencyKey: string
  }): Promise<OutboundMessage> {
    return unwrap(
      await httpClient.post(`/api/integrations/connectors/${connectorId}/messages`, input),
    )
  },
  async replayOutbound(id: string) {
    return unwrap(await httpClient.post(`/api/integrations/outbound/${id}/replay`, {}))
  },
  async webhooks(): Promise<WebhookEndpoint[]> {
    return unwrap(await httpClient.get('/api/integrations/webhooks'))
  },
  async createWebhook(input: {
    key: string
    name: string
    secretRef: string
    eventType?: string
    mapping?: Record<string, unknown>
  }): Promise<WebhookEndpoint> {
    return unwrap(await httpClient.post('/api/integrations/webhooks', input))
  },
  async webhookEvents(status?: string): Promise<WebhookEvent[]> {
    return unwrap(await httpClient.get('/api/integrations/webhook-events', { params: { status } }))
  },
  async dataSources(): Promise<DataSource[]> {
    return unwrap(await httpClient.get('/api/integrations/data-sources'))
  },
  async createDataSource(input: Record<string, unknown>): Promise<DataSource> {
    return unwrap(await httpClient.post('/api/integrations/data-sources', input))
  },
  async testDataSource(id: string) {
    return unwrap(await httpClient.post(`/api/integrations/data-sources/${id}/test`, {}))
  },
  async syncJobs(): Promise<SyncJob[]> {
    return unwrap(await httpClient.get('/api/integrations/sync-jobs'))
  },
  async createSyncJob(input: Record<string, unknown>): Promise<SyncJob> {
    return unwrap(await httpClient.post('/api/integrations/sync-jobs', input))
  },
  async runSyncJob(id: string): Promise<SyncRun> {
    return unwrap(await httpClient.post(`/api/integrations/sync-jobs/${id}/run`, {}))
  },
  async syncRuns(jobId?: string): Promise<SyncRun[]> {
    return unwrap(await httpClient.get('/api/integrations/sync-runs', { params: { jobId } }))
  },
  async metrics(): Promise<IntegrationMetrics> {
    return unwrap(await httpClient.get('/api/integrations/metrics'))
  },
}
