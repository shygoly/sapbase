/**
 * Plugins API Service
 * Handles plugin management endpoints
 */

import { httpClient } from './client'

export enum PluginStatus {
  INSTALLED = 'installed',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
}

export enum PluginType {
  INTEGRATION = 'integration',
  UI = 'ui',
  THEME = 'theme',
}

export interface Plugin {
  id: string
  name: string
  version: string
  type: PluginType
  status: PluginStatus
  description?: string
  author?: string
  license?: string
  installPath?: string
  dependencies?: Array<{ name: string; version: string }>
  permissions?: {
    api?: { endpoints?: string[]; methods?: string[] }
    database?: { tables?: string[]; operations?: string[] }
    ui?: { components?: string[]; pages?: string[] }
    modules?: { extend?: string[]; create?: boolean }
  }
  createdAt?: Date
  updatedAt?: Date
}

export interface RegistryPlugin {
  name: string
  version: string
  type: PluginType
  description?: string
  author?: string
  license?: string
}

export interface PluginRegistryResponse {
  plugins: RegistryPlugin[]
}

export const pluginsApi = {
  /**
   * Get all installed plugins
   */
  async findAll(): Promise<Plugin[]> {
    const response = await httpClient.get<any>('/api/plugins')
    return response.data.data || response.data || []
  },

  /**
   * Get a specific plugin by ID
   */
  async findOne(id: string): Promise<Plugin> {
    const response = await httpClient.get<any>(`/api/plugins/${id}`)
    return response.data.data || response.data
  },

  /**
   * Install a plugin from ZIP file
   */
  async install(file: File): Promise<Plugin> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await httpClient.post<any>('/api/plugins/install', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data.data || response.data
  },

  /**
   * Activate a plugin
   */
  async activate(id: string): Promise<Plugin> {
    const response = await httpClient.post<any>(`/api/plugins/${id}/activate`)
    return response.data.data || response.data
  },

  /**
   * Deactivate a plugin
   */
  async deactivate(id: string): Promise<Plugin> {
    const response = await httpClient.post<any>(`/api/plugins/${id}/deactivate`)
    return response.data.data || response.data
  },

  /**
   * Uninstall a plugin
   */
  async uninstall(id: string): Promise<void> {
    await httpClient.delete(`/api/plugins/${id}`)
  },

  /**
   * Browse available plugins in registry
   */
  async browseRegistry(): Promise<PluginRegistryResponse> {
    const response = await httpClient.get<any>('/api/plugins/registry')
    return response.data.data || response.data || { plugins: [] }
  },
}
