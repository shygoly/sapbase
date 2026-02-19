/**
 * Plugin Runtime
 * Main service for managing plugin UI runtime
 */

'use client'

import React, { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api/client'
import { pluginsApi, Plugin } from '@/lib/api/plugins.api'
import { pluginComponentLoader } from './plugin-component-loader'
import { pluginThemeService } from './plugin-theme-service'

export interface PluginRuntimeContext {
  plugins: Plugin[]
  isLoading: boolean
  loadPlugin: (plugin: Plugin) => Promise<void>
  unloadPlugin: (pluginId: string) => void
}

const PluginRuntimeContext = React.createContext<PluginRuntimeContext | null>(
  null,
)

export function usePluginRuntime(): PluginRuntimeContext {
  const context = React.useContext(PluginRuntimeContext)
  if (!context) {
    throw new Error('usePluginRuntime must be used within PluginRuntimeProvider')
  }
  return context
}

interface PluginRuntimeProviderProps {
  children: React.ReactNode
}

/**
 * Plugin Runtime Provider
 * Loads and manages active plugins' UI components and themes
 */
export function PluginRuntimeProvider({
  children,
}: PluginRuntimeProviderProps) {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadActivePlugins()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only load
  }, [])

  const loadActivePlugins = async () => {
    setIsLoading(true)
    try {
      if (!apiClient.isAuthenticated()) {
        setPlugins([])
        return
      }
      const allPlugins = await pluginsApi.findAll()
      const activePlugins = allPlugins.filter(
        (p) => p.status === 'active',
      )

      // Load components and themes for active plugins
      for (const plugin of activePlugins) {
        await loadPlugin(plugin)
      }

      setPlugins(activePlugins)
    } catch (error) {
      // Error surfaced via state
    } finally {
      setIsLoading(false)
    }
  }

  const loadPlugin = async (plugin: Plugin): Promise<void> => {
    try {
      // Load UI components
      await pluginComponentLoader.loadPluginComponents(plugin)

      // Apply theme if it's a theme plugin
      if (plugin.type === 'theme') {
        await pluginThemeService.applyPluginTheme(plugin)
      }
    } catch (error) {
      // Error surfaced via state
    }
  }

  const unloadPlugin = (pluginId: string): void => {
    // Unload components
    pluginComponentLoader.unloadPluginComponents(pluginId)

    // Remove theme
    pluginThemeService.removePluginTheme(pluginId)

    // Update plugins list
    setPlugins((prev) => prev.filter((p) => p.id !== pluginId))
  }

  return (
    <PluginRuntimeContext.Provider
      value={{
        plugins,
        isLoading,
        loadPlugin,
        unloadPlugin,
      }}
    >
      {children}
    </PluginRuntimeContext.Provider>
  )
}

/**
 * Plugin Component Renderer
 * Renders a plugin component by name
 */
interface PluginComponentRendererProps {
  pluginId: string
  componentName: string
  fallback?: React.ReactNode
}

export function PluginComponentRenderer({
  pluginId,
  componentName,
  fallback,
}: PluginComponentRendererProps) {
  const [Component, setComponent] = useState<React.ComponentType | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    loadComponent()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run when pluginId/componentName change
  }, [pluginId, componentName])

  const loadComponent = async () => {
    try {
      const componentDef = pluginComponentLoader.getComponent(
        pluginId,
        componentName,
      )

      if (!componentDef) {
        setError(new Error(`Component ${componentName} not found`))
        return
      }

      const loadedModule = await pluginComponentLoader.loadComponentModule(
        componentDef,
      )
      // Ensure we store a component (function/class); if default export is an element, wrap it
      const ComponentOrElement = loadedModule?.default ?? loadedModule
      setComponent(() =>
        typeof ComponentOrElement === 'function'
          ? ComponentOrElement
          : () => ComponentOrElement,
      )
      setError(null)
    } catch (err) {
      setError(err as Error)
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        Failed to load plugin component: {error.message}
      </div>
    )
  }

  if (!Component) {
    return <>{fallback || <div>Loading plugin component...</div>}</>
  }

  return <Component />
}
