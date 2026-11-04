import { Injectable, Inject, Logger } from '@nestjs/common'
import * as fs from 'fs/promises'
import * as path from 'path'
import { PLUGIN_LOADER } from '../../domain/services'
import type { IPluginLoader } from '../../domain/services'
import type { PluginManifest } from '../../domain/entities/plugin.entity'

export interface RegistryPlugin {
  name: string
  version: string
  type: string
  description?: string
  author?: string
  license?: string
  filePath: string
  manifest: PluginManifest
}

/**
 * Plugin Registry Service
 * Manages browsing and discovery of available plugins in the internal registry
 */
@Injectable()
export class PluginRegistryService {
  private readonly logger = new Logger(PluginRegistryService.name)
  private readonly registryPath: string

  constructor(
    @Inject(PLUGIN_LOADER)
    private readonly pluginLoader: IPluginLoader,
  ) {
    // Registry path: plugins/registry/ (organization-agnostic registry)
    this.registryPath = path.join(process.cwd(), 'plugins', 'registry')
  }

  /**
   * List all available plugins in the registry
   */
  async listAvailablePlugins(): Promise<RegistryPlugin[]> {
    try {
      // Ensure registry directory exists
      await fs.mkdir(this.registryPath, { recursive: true })

      const plugins: RegistryPlugin[] = []
      const entries = await fs.readdir(this.registryPath, {
        withFileTypes: true,
      })

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.zip')) {
          try {
            const filePath = path.join(this.registryPath, entry.name)
            const manifest = await this.pluginLoader.loadManifest(filePath)

            plugins.push({
              name: manifest.name,
              version: manifest.version,
              type: manifest.type,
              description: manifest.description,
              author: manifest.author,
              license: manifest.license,
              filePath,
              manifest,
            })
          } catch (error) {
            this.logger.warn(
              `Failed to load manifest from ${entry.name}: ${error}`,
            )
            // Skip invalid plugin files
          }
        }
      }

      return plugins
    } catch (error) {
      this.logger.error('Failed to list registry plugins:', error)
      return []
    }
  }

  /**
   * Get a specific plugin from the registry by name and version
   */
  async getPluginFromRegistry(
    name: string,
    version?: string,
  ): Promise<RegistryPlugin | null> {
    const plugins = await this.listAvailablePlugins()
    const matchingPlugins = plugins.filter((p) => p.name === name)

    if (matchingPlugins.length === 0) {
      return null
    }

    if (version) {
      const exactMatch = matchingPlugins.find((p) => p.version === version)
      if (exactMatch) {
        return exactMatch
      }
    }

    // Return latest version if no version specified
    // Simple version comparison (could be improved with semver)
    return matchingPlugins.sort((a, b) => {
      return b.version.localeCompare(a.version, undefined, { numeric: true })
    })[0]
  }

  /**
   * Add a plugin to the registry (for internal registry management)
   */
  async addPluginToRegistry(zipPath: string): Promise<RegistryPlugin> {
    try {
      // Validate plugin
      const manifest = await this.pluginLoader.loadManifest(zipPath)

      // Ensure registry directory exists
      await fs.mkdir(this.registryPath, { recursive: true })

      // Copy plugin to registry
      const registryFileName = `${manifest.name}-${manifest.version}.zip`
      const registryPath = path.join(this.registryPath, registryFileName)
      await fs.copyFile(zipPath, registryPath)

      this.logger.log(
        `Added plugin ${manifest.name} v${manifest.version} to registry`,
      )

      return {
        name: manifest.name,
        version: manifest.version,
        type: manifest.type,
        description: manifest.description,
        author: manifest.author,
        license: manifest.license,
        filePath: registryPath,
        manifest,
      }
    } catch (error) {
      this.logger.error('Failed to add plugin to registry:', error)
      throw error
    }
  }
}
