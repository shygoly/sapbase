import { httpClient } from './client'

export interface IdentityProviderRecord {
  id: string
  key: string
  name: string
  type: 'cas' | 'oauth2' | 'oidc' | 'saml'
  config: Record<string, unknown> | null
  secretRef: string | null
  defaultRoleName: string | null
  status: 'active' | 'inactive'
}

export interface AuthSessionRecord {
  id: string
  sid: string
  userId: string
  organizationId: string
  status: 'active' | 'revoked' | 'expired'
  ip: string | null
  userAgent: string | null
  expiresAt: string
  lastSeenAt: string | null
  revokedAt: string | null
  revokedReason: string | null
  createdAt: string
}

export interface LoginEventRecord {
  id: string
  userId: string | null
  email: string
  provider: string
  status: 'success' | 'failure'
  ip: string | null
  userAgent: string | null
  reason: string | null
  createdAt: string
}

export interface ServiceClientRecord {
  id: string
  key: string
  name: string
  scopes: string[] | null
  status: 'active' | 'inactive'
  expiresAt: string | null
  lastUsedAt: string | null
  ipAllowlist: string[] | null
  appInstallationId: string | null
}

export interface SyncRunRecord {
  id: string
  providerId: string
  status: 'running' | 'succeeded' | 'failed' | 'partial'
  confirmationStatus: 'none' | 'pending' | 'confirmed'
  stats: Record<string, unknown> | null
  diff: Record<string, unknown> | null
  error: Record<string, unknown> | null
  confirmedBy: string | null
  confirmedAt: string | null
  startedAt: string
  finishedAt: string | null
  createdAt: string
}

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as Record<string, unknown> | T
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: T }).data
  return body as T
}

export const identityApi = {
  async providers(): Promise<IdentityProviderRecord[]> {
    return unwrap(await httpClient.get('/api/identity/providers'))
  },
  async createProvider(input: {
    key: string
    name: string
    type: 'cas' | 'oauth2' | 'oidc' | 'saml'
    config?: Record<string, unknown>
    secretRef?: string
    defaultRoleName?: string
  }): Promise<IdentityProviderRecord> {
    return unwrap(await httpClient.post('/api/identity/providers', input))
  },
  async updateProvider(
    id: string,
    input: Partial<{
      name: string
      config: Record<string, unknown>
      secretRef: string | null
      defaultRoleName: string | null
      status: 'active' | 'inactive'
    }>,
  ): Promise<IdentityProviderRecord> {
    return unwrap(await httpClient.patch(`/api/identity/providers/${id}`, input))
  },
  async removeProvider(id: string): Promise<void> {
    await httpClient.delete(`/api/identity/providers/${id}`)
  },
  async sessions(userId: string): Promise<AuthSessionRecord[]> {
    return unwrap(await httpClient.get('/api/identity/sessions', { params: { userId } }))
  },
  async revokeSessions(input: { sid?: string; userId?: string; reason?: string }) {
    return unwrap<{ revoked: number }>(await httpClient.post('/api/identity/sessions/revoke', input))
  },
  async loginEvents(params: { userId?: string; limit?: number } = {}): Promise<LoginEventRecord[]> {
    return unwrap(await httpClient.get('/api/identity/login-events', { params }))
  },
  async serviceClients(): Promise<ServiceClientRecord[]> {
    return unwrap(await httpClient.get('/api/identity/service-clients'))
  },
  async createServiceClient(input: {
    key: string
    name: string
    scopes?: string[]
    expiresAt?: string | null
    ipAllowlist?: string[] | null
  }): Promise<{ client: ServiceClientRecord; secret: string }> {
    return unwrap(await httpClient.post('/api/identity/service-clients', input))
  },
  async updateServiceClient(
    id: string,
    input: Partial<{
      name: string
      scopes: string[]
      status: 'active' | 'inactive'
      expiresAt: string | null
      ipAllowlist: string[] | null
    }>,
  ): Promise<ServiceClientRecord> {
    return unwrap(await httpClient.patch(`/api/identity/service-clients/${id}`, input))
  },
  async rotateServiceClient(id: string): Promise<{ client: ServiceClientRecord; secret: string }> {
    return unwrap(await httpClient.post(`/api/identity/service-clients/${id}/rotate`, {}))
  },
  async resolveDelegation(userId: string) {
    return unwrap(await httpClient.post('/api/identity/delegation/resolve', { userId }))
  },
  async resolveDelegationScope(input: {
    userId: string
    resourceKey: string
    action?: string
  }) {
    return unwrap(await httpClient.post('/api/identity/delegation/scope', input))
  },
  async syncRuns(providerId?: string): Promise<SyncRunRecord[]> {
    return unwrap(await httpClient.get('/api/identity/sync/runs', { params: { providerId } }))
  },
  async runSync(providerKey: string) {
    return unwrap(await httpClient.post(`/api/identity/sync/${providerKey}/run`, {}))
  },
  async confirmSync(runId: string) {
    return unwrap(await httpClient.post(`/api/identity/sync/runs/${runId}/confirm`, {}))
  },
}
