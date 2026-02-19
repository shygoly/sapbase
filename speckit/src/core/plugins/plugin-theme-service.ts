/**
 * Plugin Theme Service
 * Manages theme customizations from plugins
 */

import type { Plugin } from '@/lib/api/plugins.api'

export interface ThemeCustomization {
  pluginId: string
  pluginName: string
  css?: string
  cssPath?: string
  variables?: Record<string, string>
  enabled: boolean
}

class PluginThemeService {
  private customizations: Map<string, ThemeCustomization> = new Map()
  private styleElement: HTMLStyleElement | null = null

  /**
   * Apply theme customizations from a plugin
   */
  async applyPluginTheme(plugin: Plugin): Promise<void> {
    if (plugin.type !== 'theme') {
      return
    }

    // Load theme CSS if plugin has frontend entry
    if (plugin.installPath) {
      const themePath = `/plugins/${plugin.id}/theme.css`
      const customization: ThemeCustomization = {
        pluginId: plugin.id,
        pluginName: plugin.name,
        cssPath: themePath,
        enabled: true,
      }

      this.customizations.set(plugin.id, customization)
      await this.loadThemeCSS(themePath, plugin.id)
    }
  }

  /**
   * Remove theme customizations for a plugin
   */
  removePluginTheme(pluginId: string): void {
    const customization = this.customizations.get(pluginId)
    if (customization) {
      // Remove style element if it exists
      const styleId = `plugin-theme-${pluginId}`
      const existingStyle = document.getElementById(styleId)
      if (existingStyle) {
        existingStyle.remove()
      }

      this.customizations.delete(pluginId)
    }
  }

  /**
   * Load theme CSS file
   */
  private async loadThemeCSS(cssPath: string, pluginId: string): Promise<void> {
    try {
      const response = await fetch(cssPath)
      if (!response.ok) {
        return
      }

      const css = await response.text()

      // Create or update style element
      const styleId = `plugin-theme-${pluginId}`
      let styleElement = document.getElementById(styleId) as HTMLStyleElement

      if (!styleElement) {
        styleElement = document.createElement('style')
        styleElement.id = styleId
        styleElement.setAttribute('data-plugin-id', pluginId)
        document.head.appendChild(styleElement)
      }

      styleElement.textContent = css
    } catch (error) {
      // Theme CSS load error swallowed
    }
  }

  /**
   * Apply CSS variables from plugin
   */
  applyCSSVariables(pluginId: string, variables: Record<string, string>): void {
    const root = document.documentElement
    for (const [key, value] of Object.entries(variables)) {
      root.style.setProperty(`--plugin-${pluginId}-${key}`, value)
    }
  }

  /**
   * Remove CSS variables for a plugin
   */
  removeCSSVariables(pluginId: string): void {
    const root = document.documentElement
    const style = window.getComputedStyle(root)
    const allProperties = Array.from(style)

    for (const prop of allProperties) {
      if (prop.startsWith(`--plugin-${pluginId}-`)) {
        root.style.removeProperty(prop)
      }
    }
  }

  /**
   * Enable/disable a plugin theme
   */
  setThemeEnabled(pluginId: string, enabled: boolean): void {
    const customization = this.customizations.get(pluginId)
    if (customization) {
      customization.enabled = enabled
      const styleElement = document.getElementById(
        `plugin-theme-${pluginId}`,
      ) as HTMLStyleElement
      if (styleElement) {
        styleElement.disabled = !enabled
      }
    }
  }

  /**
   * Get all active theme customizations
   */
  getActiveThemes(): ThemeCustomization[] {
    return Array.from(this.customizations.values()).filter((t) => t.enabled)
  }
}

export const pluginThemeService = new PluginThemeService()
