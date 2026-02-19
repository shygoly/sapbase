import type { Plugin } from '../entities/plugin.entity'

/**
 * Repository interface: Plugin
 */
export interface IPluginRepository {
  findById(id: string, organizationId: string): Promise<Plugin | null>
  findByName(name: string, organizationId: string): Promise<Plugin | null>
  findAll(organizationId: string): Promise<Plugin[]>
  save(plugin: Plugin): Promise<void>
  delete(id: string, organizationId: string): Promise<void>
}

export const PLUGIN_REPOSITORY = Symbol('IPluginRepository')
