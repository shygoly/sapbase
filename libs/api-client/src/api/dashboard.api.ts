import { httpClient } from './client'

export interface DashboardSummary {
  users: number
  roles: number
  appInstallations: number
  releases: number
  pendingProposals: number
  feedback7d: number
}

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as Record<string, unknown> | T
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: T }).data
  return body as T
}

export const dashboardApi = {
  async summary(): Promise<DashboardSummary> {
    return unwrap<DashboardSummary>(await httpClient.get('/api/dashboard/summary'))
  },
}
