import { httpClient } from './client'

export interface ModuleRegistry {
  id: string
  name: string
  description?: string
  moduleType: 'crud' | 'workflow' | 'integration' | 'report' | 'analytics'
  status: 'active' | 'inactive' | 'deprecated' | 'error'
  version: string
  aiModelId?: string
  createdById?: string
  aiModuleId?: string
  metadata?: {
    schemaPath?: string
    apiBasePath?: string
    entities?: string[]
    [key: string]: any
  }
  capabilities?: ModuleCapability[]
  relationships?: ModuleRelationship[]
  statistics?: ModuleStatistics[]
  createdAt: string
  updatedAt: string
}

export interface ModuleCapability {
  id: string
  moduleId: string
  capabilityType: 'crud' | 'query' | 'action' | 'workflow'
  entity?: string
  operations: string[]
  apiEndpoints: string[]
  description?: string
}

export interface ModuleRelationship {
  id: string
  sourceModuleId: string
  targetModuleId: string
  relationshipType: 'dependency' | 'integration' | 'data-flow' | 'hierarchical'
  description?: string
  configuration?: Record<string, any>
}

export interface ModuleStatistics {
  id: string
  moduleId: string
  entity?: string
  recordCount: number
  lastUpdate?: string
  errorCount: number
  averageResponseTime?: number
  healthStatus: 'healthy' | 'warning' | 'error'
  collectedAt: string
}

export interface CreateModuleRegistryDto {
  name: string
  description?: string
  moduleType?: string
  aiModelId?: string
  version?: string
  status?: string
  aiModuleId?: string
  metadata?: Record<string, any>
}

export interface CreateCapabilityDto {
  capabilityType: string
  entity?: string
  operations: string[]
  apiEndpoints: string[]
  description?: string
}

export interface ModuleRelationshipGraph {
  nodes: Array<{
    id: string
    name: string
    moduleType: string
    status: string
    version: string
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    type: string
    description?: string | null
  }>
  summary: {
    modules: number
    edges: number
    dependencies: number
    integrations: number
    dataFlows: number
  }
}

export interface ModuleHealth {
  moduleId: string
  status: 'healthy' | 'warning' | 'error'
  checks: Array<{ name: string; status: 'pass' | 'warn' | 'error'; detail: string }>
  statistics: ModuleStatistics[]
}

export interface ModuleHealthOverview {
  total: number
  healthy: number
  warning: number
  error: number
  modules: Array<{ id: string; name: string; status: string }>
}

export interface ModuleConfiguration {
  id: string
  moduleId: string
  configType: string
  schema?: Record<string, any> | null
  documentation?: string | null
  metadata?: Record<string, any> | null
}

export interface CreateRelationshipDto {
  targetModuleId: string
  relationshipType: string
  description?: string
  configuration?: Record<string, any>
}

export const moduleRegistryApi = {
  findAll: async (status?: string, type?: string): Promise<ModuleRegistry[]> => {
    const params = new URLSearchParams()
    if (status) params.append('status', status)
    if (type) params.append('type', type)
    const response = await httpClient.get(`/api/module-registry?${params.toString()}`)
    // Backend returns { code, message, data } format
    return response.data?.data || response.data || []
  },

  findOne: async (id: string): Promise<ModuleRegistry> => {
    const response = await httpClient.get(`/api/module-registry/${id}`)
    // Backend returns { code, message, data } format
    return response.data?.data || response.data
  },

  create: async (dto: CreateModuleRegistryDto): Promise<ModuleRegistry> => {
    const response = await httpClient.post('/api/module-registry', dto)
    return response.data?.data || response.data
  },

  update: async (id: string, dto: Partial<CreateModuleRegistryDto>): Promise<ModuleRegistry> => {
    const response = await httpClient.put(`/api/module-registry/${id}`, dto)
    return response.data?.data || response.data
  },

  remove: async (id: string): Promise<void> => {
    await httpClient.delete(`/api/module-registry/${id}`)
  },

  getCapabilities: async (id: string): Promise<ModuleCapability[]> => {
    const response = await httpClient.get(`/api/module-registry/${id}/capabilities`)
    return response.data?.data || response.data || []
  },

  addCapability: async (id: string, dto: CreateCapabilityDto): Promise<ModuleCapability> => {
    const response = await httpClient.post(`/api/module-registry/${id}/capabilities`, dto)
    return response.data?.data || response.data
  },

  getRelationships: async (id: string): Promise<ModuleRelationship[]> => {
    const response = await httpClient.get(`/api/module-registry/${id}/relationships`)
    return response.data?.data || response.data || []
  },

  addRelationship: async (id: string, dto: CreateRelationshipDto): Promise<ModuleRelationship> => {
    const response = await httpClient.post(`/api/module-registry/${id}/relationships`, dto)
    return response.data?.data || response.data
  },

  updateRelationship: async (
    id: string,
    relId: string,
    dto: Partial<CreateRelationshipDto>,
  ): Promise<ModuleRelationship> => {
    const response = await httpClient.put(`/api/module-registry/${id}/relationships/${relId}`, dto)
    return response.data?.data || response.data
  },

  removeRelationship: async (id: string, relId: string): Promise<void> => {
    await httpClient.delete(`/api/module-registry/${id}/relationships/${relId}`)
  },

  getGraph: async (): Promise<ModuleRelationshipGraph> => {
    const response = await httpClient.get('/api/module-registry/graph')
    return response.data?.data || response.data
  },

  getHealthOverview: async (): Promise<ModuleHealthOverview> => {
    const response = await httpClient.get('/api/module-registry/health')
    return response.data?.data || response.data
  },

  getHealth: async (id: string): Promise<ModuleHealth> => {
    const response = await httpClient.get(`/api/module-registry/${id}/health`)
    return response.data?.data || response.data
  },

  collectStatistics: async (id: string): Promise<ModuleStatistics[]> => {
    const response = await httpClient.post(`/api/module-registry/${id}/statistics/collect`)
    return response.data?.data || response.data || []
  },

  updateStatus: async (id: string, status: string): Promise<ModuleRegistry> => {
    const response = await httpClient.put(`/api/module-registry/${id}/status`, { status })
    return response.data?.data || response.data
  },

  getDocumentation: async (
    id: string,
  ): Promise<{ moduleId: string; markdown: string; generatedAt: string }> => {
    const response = await httpClient.get(`/api/module-registry/${id}/documentation`)
    return response.data?.data || response.data
  },

  getStatistics: async (id: string): Promise<ModuleStatistics[]> => {
    const response = await httpClient.get(`/api/module-registry/${id}/statistics`)
    return response.data?.data || response.data || []
  },

  updateStatistics: async (
    id: string,
    entity: string,
    stats: Partial<ModuleStatistics>,
  ): Promise<ModuleStatistics> => {
    const response = await httpClient.put(`/api/module-registry/${id}/statistics/${entity}`, stats)
    return response.data?.data || response.data
  },

  getConfigurations: async (id: string): Promise<ModuleConfiguration[]> => {
    const response = await httpClient.get(`/api/module-registry/${id}/configurations`)
    return response.data?.data || response.data || []
  },

  addConfiguration: async (
    id: string,
    configType: string,
    schema?: Record<string, any>,
    documentation?: string,
  ): Promise<ModuleConfiguration> => {
    const response = await httpClient.post(`/api/module-registry/${id}/configurations`, {
      configType,
      schema,
      documentation,
    })
    return response.data?.data || response.data
  },

  updateConfiguration: async (
    id: string,
    configId: string,
    dto: Partial<Pick<ModuleConfiguration, 'configType' | 'schema' | 'documentation' | 'metadata'>>,
  ): Promise<ModuleConfiguration> => {
    const response = await httpClient.put(
      `/api/module-registry/${id}/configurations/${configId}`,
      dto,
    )
    return response.data?.data || response.data
  },

  deleteConfiguration: async (id: string, configId: string): Promise<void> => {
    await httpClient.delete(`/api/module-registry/${id}/configurations/${configId}`)
  },
}
