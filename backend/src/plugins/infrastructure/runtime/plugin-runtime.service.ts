import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { Plugin } from '../../domain/entities/plugin.entity'
import type { IPluginContext } from '../../domain/services/i-plugin-context'
import { PluginContextProvider } from './plugin-context-provider.service'

export interface PluginRuntime {
  plugin: Plugin
  instance: any
  context: IPluginContext
  apiRoutes: Array<{
    path: string
    method: string
    handler: Function
  }>
}

/**
 * Plugin entry point interface
 * Plugins should export a default function or class that implements this
 */
export interface PluginEntryPoint {
  /**
   * Initialize the plugin with context
   * Called when plugin is activated
   */
  initialize?: (context: IPluginContext) => Promise<void> | void

  /**
   * Cleanup plugin resources
   * Called when plugin is deactivated
   */
  cleanup?: () => Promise<void> | void

  /**
   * Get API route handlers
   * Returns a map of route paths to handler functions
   */
  getApiHandlers?: () => Record<
    string,
    (req: any, res: any, next?: any) => Promise<any> | any
  >
}

@Injectable()
export class PluginRuntimeService {
  private readonly logger = new Logger(PluginRuntimeService.name)
  private readonly activePlugins = new Map<string, PluginRuntime>()

  constructor(private readonly contextProvider: PluginContextProvider) {}

  async loadPlugin(plugin: Plugin): Promise<PluginRuntime> {
    const entryPath = path.join(plugin.installPath, plugin.manifest.entry.backend)

    try {
      // Create plugin context
      const context = this.contextProvider.createContext(plugin)

      // Load plugin code dynamically
      let pluginInstance: PluginEntryPoint | null = null

      try {
        // Check if entry file exists
        await fs.access(entryPath)

        // For TypeScript/JavaScript plugins, we'll use dynamic require
        // In production, this might need to be transpiled first
        // For now, we support CommonJS modules
        delete require.cache[require.resolve(entryPath)]
        const pluginModule = require(entryPath)

        // Support both default export and named exports
        pluginInstance =
          pluginModule.default || pluginModule.Plugin || pluginModule

        // If it's a class, instantiate it
        if (pluginInstance && typeof pluginInstance === 'function') {
          if (this.isClass(pluginInstance)) {
            pluginInstance = new (pluginInstance as new () => PluginEntryPoint)()
          }
        }

        // Initialize plugin if it has an initialize method
        if (
          pluginInstance &&
          typeof pluginInstance.initialize === 'function'
        ) {
          await pluginInstance.initialize(context)
        }
      } catch (loadError: any) {
        // If file doesn't exist or can't be loaded, create a minimal instance
        this.logger.warn(
          `Could not load plugin code from ${entryPath}: ${loadError.message}. Using minimal runtime.`,
        )
        pluginInstance = null
      }

      const runtime: PluginRuntime = {
        plugin,
        instance: pluginInstance,
        context,
        apiRoutes: [],
      }

      // Register API routes if plugin provides handlers
      if (pluginInstance?.getApiHandlers) {
        const handlers = pluginInstance.getApiHandlers()
        for (const [routePath, handler] of Object.entries(handlers)) {
          // Match route to manifest declaration
          const manifestRoute = plugin.manifest.api?.routes?.find(
            (r) => r.path === routePath || r.path === `/${routePath}`,
          )

          if (manifestRoute) {
            runtime.apiRoutes.push({
              path: manifestRoute.path,
              method: manifestRoute.method.toLowerCase(),
              handler,
            })
          } else {
            // If route not in manifest, log warning but still register
            this.logger.warn(
              `Plugin ${plugin.name} registered route ${routePath} not declared in manifest`,
            )
          }
        }
      }

      // Also register routes from manifest if plugin doesn't provide handlers
      if (
        runtime.apiRoutes.length === 0 &&
        plugin.manifest.api?.routes
      ) {
        for (const route of plugin.manifest.api.routes) {
          runtime.apiRoutes.push({
            path: route.path,
            method: route.method.toLowerCase(),
            handler: async (req: any, res: any) => {
              // Fallback handler if plugin doesn't provide one
              this.logger.log(
                `Plugin ${plugin.name} route ${route.method} ${route.path} called (no handler provided)`,
              )
              return res
                .status(501)
                .json({ message: 'Plugin route handler not implemented' })
            },
          })
        }
      }

      this.activePlugins.set(plugin.id, runtime)
      this.logger.log(`Plugin ${plugin.name} loaded successfully`)

      return runtime
    } catch (error) {
      this.logger.error(`Failed to load plugin ${plugin.name}:`, error)
      throw error
    }
  }

  /**
   * Check if a value is a class constructor
   */
  private isClass(value: any): boolean {
    return (
      typeof value === 'function' &&
      value.prototype &&
      value.prototype.constructor === value
    )
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    const runtime = this.activePlugins.get(pluginId)
    if (runtime) {
      // Call cleanup if plugin has cleanup method
      if (
        runtime.instance &&
        typeof runtime.instance.cleanup === 'function'
      ) {
        try {
          await runtime.instance.cleanup()
        } catch (error) {
          this.logger.error(
            `Error during plugin ${runtime.plugin.name} cleanup:`,
            error,
          )
        }
      }

      this.activePlugins.delete(pluginId)
      this.logger.log(`Plugin ${runtime.plugin.name} unloaded`)
    }
  }

  getRuntime(pluginId: string): PluginRuntime | undefined {
    return this.activePlugins.get(pluginId)
  }

  getAllRuntimes(): PluginRuntime[] {
    return Array.from(this.activePlugins.values())
  }

  getApiRoutes(): Array<{
    pluginId: string
    path: string
    method: string
    handler: Function
  }> {
    const routes: Array<{
      pluginId: string
      path: string
      method: string
      handler: Function
    }> = []

    for (const [pluginId, runtime] of this.activePlugins.entries()) {
      for (const route of runtime.apiRoutes) {
        routes.push({
          pluginId,
          path: route.path,
          method: route.method,
          handler: route.handler,
        })
      }
    }

    return routes
  }
}
