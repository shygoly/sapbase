import { httpClient } from './client'

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as Record<string, unknown> | T
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: T }).data
  return body as T
}

export const feedbackApi = {
  async list(appKey?: string, status?: string): Promise<unknown[]> {
    const params = new URLSearchParams()
    if (appKey) params.set('appKey', appKey)
    if (status) params.set('status', status)
    const suffix = params.toString() ? `?${params.toString()}` : ''
    return unwrap<unknown[]>(await httpClient.get(`/api/agent/feedback${suffix}`)) ?? []
  },
  async triage(appKey?: string): Promise<unknown[]> {
    return unwrap<unknown[]>(
      await httpClient.get(`/api/agent/feedback/triage${appKey ? `?appKey=${appKey}` : ''}`),
    ) ?? []
  },
  async create(payload: Record<string, unknown>): Promise<unknown> {
    return unwrap(await httpClient.post('/api/agent/feedback', payload))
  },
}

export const knowledgeApi = {
  async published(releaseId?: string): Promise<unknown[]> {
    return unwrap<unknown[]>(
      await httpClient.get(`/api/agent-knowledge/published${releaseId ? `?releaseId=${releaseId}` : ''}`),
    ) ?? []
  },
  async publish(id: string, confirmedSensitive = false): Promise<unknown> {
    return unwrap(await httpClient.post(`/api/agent-knowledge/${id}/publish`, { confirmedSensitive }))
  },
  async createDraft(payload: Record<string, unknown>): Promise<unknown> {
    return unwrap(await httpClient.post('/api/agent-knowledge/drafts', payload))
  },
  async rollback(id: string): Promise<unknown> {
    return unwrap(await httpClient.post(`/api/agent-knowledge/${id}/rollback`, {}))
  },
}

export const evalApi = {
  async seed(): Promise<number> {
    return unwrap<number>(await httpClient.post('/api/agent-eval/seed', {}))
  },
  async runs(releaseId: string): Promise<unknown[]> {
    return unwrap<unknown[]>(await httpClient.get(`/api/agent-eval/runs/${releaseId}`)) ?? []
  },
  async gate(payload: Record<string, unknown>): Promise<{ ok: boolean; reasons: string[] }> {
    return unwrap(await httpClient.post('/api/agent-eval/gate', payload))
  },
}

export const automationApi = {
  async policy(appKey: string): Promise<Record<string, unknown>> {
    return unwrap(await httpClient.get(`/api/release-automation/${appKey}/policy`))
  },
  async upsertPolicy(appKey: string, payload: Record<string, unknown>): Promise<unknown> {
    return unwrap(await httpClient.post(`/api/release-automation/${appKey}/policy`, payload))
  },
  async audit(): Promise<Record<string, unknown>> {
    return unwrap(await httpClient.get('/api/release-automation/audit/quarterly'))
  },
  async disable(appKey: string): Promise<unknown> {
    return unwrap(await httpClient.post(`/api/release-automation/${appKey}/disable`, {}))
  },
}
