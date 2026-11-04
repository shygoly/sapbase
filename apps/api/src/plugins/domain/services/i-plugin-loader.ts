import type { PluginManifest } from '../entities/plugin.entity'

/**
 * Service interface: Plugin Loader
 */
export interface IPluginLoader {
  loadManifest(zipPath: string): Promise<PluginManifest>
  extractPlugin(zipPath: string, targetPath: string): Promise<void>
  validateManifest(manifest: PluginManifest): Promise<void>
  loadPluginCode(pluginPath: string, entryPoint: string): Promise<any>
}

export const PLUGIN_LOADER = Symbol('IPluginLoader')
