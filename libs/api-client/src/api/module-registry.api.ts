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

  removeRelationship: async (id: string, relId: string): Promise<void> => {
    await httpClient.delete(`/api/module-registry/${id}/relationships/${relId}`)
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

  getConfigurations: async (id: string): Promise<any[]> => {
    const response = await httpClient.get(`/api/module-registry/${id}/configurations`)
    return response.data?.data || response.data || []
  },

  addConfiguration: async (
    id: string,
    configType: string,
    schema?: Record<string, any>,
    documentation?: string,
  ): Promise<any> => {
    const response = await httpClient.post(`/api/module-registry/${id}/configurations`, {
      configType,
      schema,
      documentation,
    })
    return response.data?.data || response.data
  },
}
