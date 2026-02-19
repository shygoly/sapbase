/**
 * Plugin UI Component Loader Tests
 */

import { pluginComponentLoader } from '../plugin-component-loader'
import type { Plugin } from '@/lib/api/plugins.api'

describe('PluginComponentLoader', () => {
  beforeEach(() => {
    // Clear registry before each test
    const registry = (pluginComponentLoader as any).registry
    registry.components.clear()
    registry.routes.clear()
  })

  describe('loadPluginComponents', () => {
    it('should register UI components from plugin manifest', async () => {
      const plugin: Plugin = {
        id: 'test-plugin',
        name: 'test-plugin',
        version: '1.0.0',
        type: 'ui',
        status: 'active',
        permissions: {
          ui: {
            components: ['TestComponent'],
            pages: ['test-page'],
          },
        },
      } as Plugin

      await pluginComponentLoader.loadPluginComponents(plugin)

      const component = pluginComponentLoader.getComponent(
        'test-plugin',
        'TestComponent',
      )
      expect(component).toBeDefined()
      expect(component?.componentName).toBe('TestComponent')
      expect(component?.componentType).toBe('component')
    })

    it('should register plugin pages with routes', async () => {
      const plugin: Plugin = {
        id: 'test-plugin',
        name: 'test-plugin',
        version: '1.0.0',
        type: 'ui',
        status: 'active',
        permissions: {
          ui: {
            pages: ['test-page'],
          },
        },
      } as Plugin

      await pluginComponentLoader.loadPluginComponents(plugin)

      const route = pluginComponentLoader.getComponentByRoute(
        '/plugins/test-plugin/test-page',
      )
      expect(route).toBeDefined()
      expect(route?.componentName).toBe('test-page')
      expect(route?.componentType).toBe('page')
    })

    it('should not register components if plugin has no UI permissions', async () => {
      const plugin: Plugin = {
        id: 'test-plugin',
        name: 'test-plugin',
        version: '1.0.0',
        type: 'integration',
        status: 'active',
        permissions: {},
      } as Plugin

      await pluginComponentLoader.loadPluginComponents(plugin)

      const components = pluginComponentLoader.getPluginComponents('test-plugin')
      expect(components).toHaveLength(0)
    })
  })

  describe('unloadPluginComponents', () => {
    it('should remove all components for a plugin', async () => {
      const plugin: Plugin = {
        id: 'test-plugin',
        name: 'test-plugin',
        version: '1.0.0',
        type: 'ui',
        status: 'active',
        permissions: {
          ui: {
            components: ['TestComponent'],
            pages: ['test-page'],
          },
        },
      } as Plugin

      await pluginComponentLoader.loadPluginComponents(plugin)
      expect(
        pluginComponentLoader.getPluginComponents('test-plugin'),
      ).toHaveLength(2)

      pluginComponentLoader.unloadPluginComponents('test-plugin')
      expect(
        pluginComponentLoader.getPluginComponents('test-plugin'),
      ).toHaveLength(0)
    })
  })

  describe('getComponent', () => {
    it('should retrieve component by plugin ID and name', async () => {
      const plugin: Plugin = {
        id: 'test-plugin',
        name: 'test-plugin',
        version: '1.0.0',
        type: 'ui',
        status: 'active',
        permissions: {
          ui: {
            components: ['TestComponent'],
          },
        },
      } as Plugin

      await pluginComponentLoader.loadPluginComponents(plugin)

      const component = pluginComponentLoader.getComponent(
        'test-plugin',
        'TestComponent',
      )
      expect(component).toBeDefined()
      expect(component?.componentName).toBe('TestComponent')
    })

    it('should return undefined for non-existent component', () => {
      const component = pluginComponentLoader.getComponent(
        'non-existent',
        'Component',
      )
      expect(component).toBeUndefined()
    })
  })

  describe('getAllRoutes', () => {
    it('should return all registered plugin routes', async () => {
      const plugin1: Plugin = {
        id: 'plugin-1',
        name: 'plugin-1',
        version: '1.0.0',
        type: 'ui',
        status: 'active',
        permissions: {
          ui: {
            pages: ['page1'],
          },
        },
      } as Plugin

      const plugin2: Plugin = {
        id: 'plugin-2',
        name: 'plugin-2',
        version: '1.0.0',
        type: 'ui',
        status: 'active',
        permissions: {
          ui: {
            pages: ['page2'],
          },
        },
      } as Plugin

      await pluginComponentLoader.loadPluginComponents(plugin1)
      await pluginComponentLoader.loadPluginComponents(plugin2)

      const routes = pluginComponentLoader.getAllRoutes()
      expect(routes.size).toBe(2)
      expect(routes.has('/plugins/plugin-1/page1')).toBe(true)
      expect(routes.has('/plugins/plugin-2/page2')).toBe(true)
    })
  })
})
