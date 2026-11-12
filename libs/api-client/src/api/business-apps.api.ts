import { httpClient } from './client'

export type BusinessAppDeploymentProfile =
  | 'shared-saas'
  | 'dedicated-saas'
  | 'standalone'

export type BusinessAppStatus =
  | 'installing'
  | 'active'
  | 'suspended'
  | 'failed'
  | 'uninstalling'
  | 'removed'

export interface BusinessAppInstallation {
  id: string
  organizationId: string
  appKey: string
  displayName: string
  slug: string
  blueprintId: string
  blueprintVersion: string
  releaseDigest: string
  runtimeRequirement: string
  deploymentProfile: BusinessAppDeploymentProfile
  status: BusinessAppStatus
  config: Record<string, unknown>
  license?: {
    issuer: string
    expiresAt?: string
  } | null
  currentRevisionId?: string | null
  createdById?: string | null
  createdAt: string
  updatedAt: string
}

export interface BusinessAppInstallationRevision {
  id: string
  organizationId: string
  appInstallationId: string
  previousRevisionId?: string | null
  packageId: string
  blueprintId: string
  blueprintVersion: string
  releaseDigest: string
  runtimeRequirement: string
  action: 'installed' | 'upgraded' | 'rollback' | 'uninstalled'
  config: Record<string, unknown>
  license?: {
    issuer: string
    expiresAt?: string
  } | null
  createdById?: string | null
  createdAt: string
}

export interface BusinessAppNavigation {
  installation: {
    id: string
    appKey: string
    blueprintId: string
    blueprintVersion: string
    releaseDigest: string
    status: BusinessAppStatus
    deploymentProfile: BusinessAppDeploymentProfile
  }
  source: 'blueprint-ui' | 'none'
  navigation: Array<{
    identifier: string
    label: string
    path: string
    icon?: string
    order: number
    permissions: string[]
  }>
  routes: Array<{
    identifier: string
    label?: string
    type: 'list' | 'form' | 'detail'
    entity: string
    route?: string
    fields: string[]
  }>
  effectivePermissions: string[]
}

export const businessAppsApi = {
  async findAll(): Promise<BusinessAppInstallation[]> {
    const response = await httpClient.get<any>('/api/apps')
    return response.data.data || response.data || []
  },

  async findOne(id: string): Promise<BusinessAppInstallation> {
    const response = await httpClient.get<any>(`/api/apps/${id}`)
    return response.data.data || response.data
  },

  async install(
    packageId: string,
    deploymentProfile: BusinessAppDeploymentProfile = 'shared-saas',
  ): Promise<BusinessAppInstallation> {
    const response = await httpClient.post<any>('/api/apps/install', {
      packageId,
      deploymentProfile,
    })
    return response.data.data || response.data
  },

  async navigation(id: string): Promise<BusinessAppNavigation> {
    const response = await httpClient.get<any>(`/api/apps/${id}/navigation`)
    return response.data.data || response.data
  },

  async listRevisions(id: string): Promise<BusinessAppInstallationRevision[]> {
    const response = await httpClient.get<any>(`/api/apps/${id}/revisions`)
    return response.data.data || response.data || []
  },

  async upgrade(id: string, packageId: string): Promise<BusinessAppInstallation> {
    const response = await httpClient.post<any>(`/api/apps/${id}/upgrade`, {
      packageId,
    })
    return response.data.data || response.data
  },

  async rollback(
    id: string,
    revisionId?: string,
  ): Promise<BusinessAppInstallation> {
    const response = await httpClient.post<any>(`/api/apps/${id}/rollback`, {
      ...(revisionId ? { revisionId } : {}),
    })
    return response.data.data || response.data
  },
}
