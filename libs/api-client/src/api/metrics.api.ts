import { httpClient } from './client'

export type MetricPeriod = 'hour' | 'day' | 'week' | 'month'
export type MetricAggregation = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'ratio' | 'distinct_count'
export type MetricSourceType = 'blueprint' | 'platform' | 'event' | 'computed'

export interface MetricDefinition {
  id: string
  key: string
  name: string
  period: MetricPeriod
  aggregation: MetricAggregation
  sourceType: MetricSourceType
  sourceConfig: Record<string, unknown>
  dimensions: string[]
  permissions: string[]
  version: number
  status: 'active' | 'inactive'
  description?: string | null
}

export interface MetricPoint {
  periodStart: string
  dimensions: Record<string, unknown>
  value: number
  sampleCount: number
}

export interface MetricQueryResult {
  metric: { key: string; name: string; version: number; period: string; aggregation: string }
  items: MetricPoint[]
  comparison?: { mode: string; items: MetricPoint[] }
  cached: boolean
}

export interface DashboardWidget {
  id: string
  key: string
  type: 'number' | 'bar' | 'line' | 'pie' | 'ranking' | 'table'
  metricKey: string
  config: Record<string, unknown>
  layout: Record<string, unknown>
  order: number
}

export interface Dashboard {
  id: string
  key: string
  name: string
  description?: string | null
  visibility: Record<string, unknown>
  defaultFilters: Record<string, unknown>
  layout: unknown[]
  status: 'active' | 'inactive'
}

export interface MetricAlert {
  id: string
  key: string
  metricKey: string
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'no_data'
  threshold: string | null
  windowMinutes: number
  frequencyMinutes: number
  cooldownMinutes: number
  status: 'active' | 'inactive'
  silenceUntil: string | null
  scope?: Record<string, unknown>
  channels?: string[]
  metadata?: Record<string, unknown> | null
}

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as Record<string, unknown> | T
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: T }).data
  return body as T
}

export const metricsApi = {
  async definitions(): Promise<MetricDefinition[]> {
    return unwrap(await httpClient.get('/api/metrics/definitions'))
  },

  async createDefinition(input: Partial<MetricDefinition>): Promise<MetricDefinition> {
    return unwrap(await httpClient.post('/api/metrics/definitions', input))
  },

  async query(input: {
    metricKey: string
    from?: string
    to?: string
    dimensions?: string[]
    filters?: Record<string, unknown>
    scopeNodeIds?: string[]
    compare?: 'none' | 'previous' | 'year'
  }): Promise<MetricQueryResult> {
    return unwrap(await httpClient.post('/api/metrics/query', input))
  },

  async snapshot(): Promise<{ metrics: number; values: number }> {
    return unwrap(await httpClient.post('/api/metrics/snapshot', {}))
  },

  async backfill(input: { metricKey?: string; days: number }): Promise<{ days: number; values: number }> {
    return unwrap(await httpClient.post('/api/metrics/backfill', input))
  },

  async dashboards(): Promise<Dashboard[]> {
    return unwrap(await httpClient.get('/api/metrics/dashboards'))
  },

  async dashboard(key: string): Promise<{ dashboard: Dashboard; widgets: DashboardWidget[] }> {
    return unwrap(await httpClient.get(`/api/metrics/dashboards/${key}`))
  },

  async queryDashboard(
    key: string,
    input: { from?: string; to?: string; compare?: 'none' | 'previous' | 'year' },
  ): Promise<{ dashboard: Dashboard; widgets: Array<{ widget: DashboardWidget; result: MetricQueryResult }> }> {
    return unwrap(await httpClient.post(`/api/metrics/dashboards/${key}/query`, input))
  },

  async createDashboard(input: Partial<Dashboard> & { widgets?: Array<Partial<DashboardWidget>> }): Promise<Dashboard> {
    return unwrap(await httpClient.post('/api/metrics/dashboards', input))
  },

  async alerts(): Promise<MetricAlert[]> {
    return unwrap(await httpClient.get('/api/metrics/alerts'))
  },

  async createAlert(input: Partial<MetricAlert>): Promise<MetricAlert> {
    return unwrap(await httpClient.post('/api/metrics/alerts', input))
  },

  async evaluateAlerts(): Promise<{ evaluated: number; firing: number; resolved: number }> {
    return unwrap(await httpClient.post('/api/metrics/alerts/evaluate', {}))
  },

  async alertEvents(limit = 100): Promise<Array<Record<string, unknown>>> {
    return unwrap(await httpClient.get(`/api/metrics/alerts/events?limit=${limit}`))
  },

  async export(input: {
    format: 'csv' | 'json' | 'xlsx' | 'pdf' | 'md'
    metricKeys: string[]
    from?: string
    to?: string
  }): Promise<{ jobId: string; status: string }> {
    return unwrap(await httpClient.post('/api/metrics/export', input))
  },
}
