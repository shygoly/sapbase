/**
 * Plugin UI Component Loader
 * Loads and registers UI components from plugins
 */

import type { Plugin } from '@/lib/api/plugins.api'

export interface PluginComponent {
  pluginId: string
  pluginName: string
  componentName: string
  componentPath: string
  componentType: 'page' | 'component' | 'widget'
  route?: string
}

export interface PluginComponentRegistry {
  components: Map<string, PluginComponent>
  routes: Map<string, PluginComponent>
}

class PluginComponentLoaderService {
  private registry: PluginComponentRegistry = {
    components: new Map(),
    routes: new Map(),
  }

  /**
   * Load plugin UI components from manifest
   */
  async loadPluginComponents(plugin: Plugin): Promise<void> {
    if (!plugin.permissions?.ui) {
      return
    }

    const basePath = `/plugins/${plugin.id}`

    // Register components
    if (plugin.permissions.ui.components) {
      for (const componentName of plugin.permissions.ui.components) {
        const component: PluginComponent = {
          pluginId: plugin.id,
          pluginName: plugin.name,
          componentName,
          componentPath: `${basePath}/components/${componentName}`,
          componentType: 'component',
        }
        this.registry.components.set(
          `${plugin.id}:${componentName}`,
          component,
        )
      }
    }

    // Register pages
    if (plugin.permissions.ui.pages) {
      for (const pageName of plugin.permissions.ui.pages) {
        const component: PluginComponent = {
          pluginId: plugin.id,
          pluginName: plugin.name,
          componentName: pageName,
          componentPath: `${basePath}/pages/${pageName}`,
          componentType: 'page',
          route: `/plugins/${plugin.id}/${pageName}`,
        }
        this.registry.components.set(`${plugin.id}:${pageName}`, component)
        if (component.route) {
          this.registry.routes.set(component.route, component)
        }
      }
    }
  }

  /**
   * Unload plugin components
   */
  unloadPluginComponents(pluginId: string): void {
    // Remove all components for this plugin
    const keysToDelete: string[] = []
    for (const [key, component] of this.registry.components.entries()) {
      if (component.pluginId === pluginId) {
        keysToDelete.push(key)
        if (component.route) {
          this.registry.routes.delete(component.route)
        }
      }
    }
    keysToDelete.forEach((key) => this.registry.components.delete(key))
  }

  /**
   * Get component by plugin ID and component name
   */
  getComponent(pluginId: string, componentName: string): PluginComponent | undefined {
    return this.registry.components.get(`${pluginId}:${componentName}`)
  }

  /**
   * Get component by route
   */
  getComponentByRoute(route: string): PluginComponent | undefined {
    return this.registry.routes.get(route)
  }

  /**
   * Get all components for a plugin
   */
  getPluginComponents(pluginId: string): PluginComponent[] {
    const components: PluginComponent[] = []
    for (const component of this.registry.components.values()) {
      if (component.pluginId === pluginId) {
        components.push(component)
      }
    }
    return components
  }

  /**
   * Get all registered routes
   */
  getAllRoutes(): Map<string, PluginComponent> {
    return new Map(this.registry.routes)
  }

  /**
   * Load component dynamically from plugin path
   */
  async loadComponentModule(component: PluginComponent): Promise<any> {
    try {
      // In a real implementation, this would load the component from the plugin's static assets
      // For now, we'll return a placeholder
      const loadedModule = await import(
        /* @vite-ignore */
        component.componentPath
      ).catch(() => {
        // Fallback: try to load from public plugins directory
        const base =
          typeof window !== 'undefined'
            ? window.location.origin
            : process.env.NEXT_PUBLIC_APP_URL ?? ''
        return import(/* webpackIgnore: true */ `${base}/plugins/${component.pluginId}/${component.componentName}.js`)
      })

      return loadedModule.default || loadedModule
    } catch (error) {
      throw error
    }
  }
}

export const pluginComponentLoader = new PluginComponentLoaderService()
