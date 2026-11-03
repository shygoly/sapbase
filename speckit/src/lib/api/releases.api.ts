import { httpClient } from './client'

export interface ReleaseView {
  id: string
  appKey: string
  version: string
  channel: string
  status: string
  digest: string
  publishedAt?: string | null
  changelog?: Record<string, unknown>
}

export interface ProposalView {
  id: string
  appKey: string
  title: string
  status: string
  type?: string
  areas?: string[]
  summary?: string
  createdAt?: string
  risk?: Record<string, unknown>
  evidence?: unknown[]
  diff?: Record<string, unknown>
  rollbackPlan?: Record<string, unknown>
  testPlan?: Record<string, unknown>
}

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as Record<string, unknown> | T
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: T }).data
  return body as T
}

export const releasesApi = {
  async list(appKey?: string): Promise<ReleaseView[]> {
    const response = await httpClient.get(`/api/builder/releases${appKey ? `?appKey=${appKey}` : ''}`)
    return unwrap<ReleaseView[]>(response) ?? []
  },
  async get(id: string): Promise<ReleaseView> {
    return unwrap<ReleaseView>(await httpClient.get(`/api/builder/releases/${id}`))
  },
  async impact(id: string): Promise<{ items: unknown[]; diff: unknown[] }> {
    return unwrap(await httpClient.get(`/api/builder/releases/${id}/impact`))
  },
  async activate(id: string, appInstallationId: string, reason?: string): Promise<unknown> {
    return unwrap(
      await httpClient.post(`/api/builder/releases/${id}/activate`, {
        appInstallationId,
        reason,
      }),
    )
  },
  async rollback(id: string, appInstallationId: string, reason: string): Promise<unknown> {
    return unwrap(
      await httpClient.post(`/api/builder/releases/${id}/rollback`, {
        appInstallationId,
        reason,
      }),
    )
  },
  async previewToken(id: string): Promise<string> {
    const result = unwrap<{ token: string }>(
      await httpClient.post(`/api/builder/releases/${id}/preview-token`, {}),
    )
    return result.token
  },
  async createDraft(appKey: string, content: Record<string, unknown> = {}): Promise<unknown> {
    return unwrap(await httpClient.post(`/api/builder/apps/${appKey}/drafts`, { content }))
  },
  async whatsNew(appKey: string, appInstallationId: string): Promise<{ release: ReleaseView | null; items: unknown[]; unread: boolean }> {
    return unwrap(
      await httpClient.get(`/api/apps/${appKey}/whats-new?appInstallationId=${encodeURIComponent(appInstallationId)}`),
    )
  },
  async markWhatsNewRead(appKey: string, releaseId: string, appInstallationId: string): Promise<unknown> {
    return unwrap(
      await httpClient.post(`/api/apps/${appKey}/whats-new/${releaseId}/read`, { appInstallationId }),
    )
  },
  async createProposal(payload: Record<string, unknown>): Promise<ProposalView> {
    return unwrap<ProposalView>(await httpClient.post('/api/builder/proposals', payload))
  },
  async listProposals(appKey?: string, status?: string): Promise<ProposalView[]> {
    const params = new URLSearchParams()
    if (appKey) params.set('appKey', appKey)
    if (status) params.set('status', status)
    const suffix = params.toString() ? `?${params.toString()}` : ''
    return unwrap<ProposalView[]>(await httpClient.get(`/api/builder/proposals${suffix}`)) ?? []
  },
  async getProposal(id: string): Promise<ProposalView> {
    return unwrap<ProposalView>(await httpClient.get(`/api/builder/proposals/${id}`))
  },
  async validateProposal(id: string): Promise<ProposalView> {
    return unwrap<ProposalView>(await httpClient.post(`/api/builder/proposals/${id}/validate`, {}))
  },
  async approveProposal(id: string, role: string, comment?: string): Promise<ProposalView> {
    return unwrap<ProposalView>(
      await httpClient.post(`/api/builder/proposals/${id}/approve`, { role, comment }),
    )
  },
  async rejectProposal(id: string, role: string, reason: string): Promise<ProposalView> {
    return unwrap<ProposalView>(
      await httpClient.post(`/api/builder/proposals/${id}/reject`, { role, reason }),
    )
  },
}
