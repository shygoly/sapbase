import { httpClient } from './client'

export interface OfflinePackageRecord {
  id: string
  key: string
  version: number
  title: string
  status: 'draft' | 'published' | 'revoked'
  expiresAt: string | null
  signature: string | null
  manifest: Record<string, unknown>
}

export interface OfflineDeviceRecord {
  id: string
  deviceId: string
  name: string | null
  status: 'active' | 'revoked'
  lastSeenAt: string | null
}

export interface OfflineEntitlementRecord {
  id: string
  packageId: string
  userId: string
  deviceId: string
  status: 'active' | 'revoked' | 'expired'
  expiresAt: string
}

function unwrap<T>(response: { data: unknown }): T {
  const body = response.data as Record<string, unknown> | T
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: T }).data
  return body as T
}

export const offlineApi = {
  async packages(): Promise<OfflinePackageRecord[]> {
    return unwrap(await httpClient.get('/api/offline/packages'))
  },
  async createPackage(input: {
    key: string
    title: string
    expiresAt?: string
    publish?: boolean
    assets: Array<{ assetId: string; variant?: string }>
  }): Promise<OfflinePackageRecord> {
    return unwrap(await httpClient.post('/api/offline/packages', input))
  },
  async publish(id: string): Promise<OfflinePackageRecord> {
    return unwrap(await httpClient.post(`/api/offline/packages/${id}/publish`, {}))
  },
  async revokePackage(id: string): Promise<{ revoked: boolean }> {
    return unwrap(await httpClient.post(`/api/offline/packages/${id}/revoke`, {}))
  },
  async manifest(
    id: string,
    deviceId: string,
  ): Promise<{ manifest: Record<string, unknown>; signature: string | null; expiresAt: string }> {
    return unwrap(
      await httpClient.get(`/api/offline/packages/${id}/manifest`, { params: { deviceId } }),
    )
  },
  async registerDevice(input: { deviceId: string; name?: string }): Promise<OfflineDeviceRecord> {
    return unwrap(await httpClient.post('/api/offline/devices', input))
  },
  async devices(): Promise<OfflineDeviceRecord[]> {
    return unwrap(await httpClient.get('/api/offline/devices'))
  },
  async revokeDevice(deviceId: string, userId: string): Promise<{ revoked: boolean }> {
    return unwrap(
      await httpClient.post(`/api/offline/devices/${deviceId}/revoke`, { userId }),
    )
  },
  async grant(
    packageId: string,
    input: { userId: string; deviceId: string; expiresAt?: string },
  ): Promise<OfflineEntitlementRecord> {
    return unwrap(await httpClient.post(`/api/offline/packages/${packageId}/entitlements`, input))
  },
  async entitlements(userId?: string): Promise<OfflineEntitlementRecord[]> {
    return unwrap(
      await httpClient.get('/api/offline/entitlements', { params: userId ? { userId } : {} }),
    )
  },
  async revokeEntitlement(id: string): Promise<{ revoked: boolean }> {
    return unwrap(await httpClient.post(`/api/offline/entitlements/${id}/revoke`, {}))
  },
  async cleanup(): Promise<{ expired: number; revoked: number }> {
    return unwrap(await httpClient.post('/api/offline/cleanup', {}))
  },
}
