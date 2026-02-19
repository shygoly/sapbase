import type { Plugin } from '../entities/plugin.entity'

export enum PluginEventType {
  INSTALLED = 'plugin.installed',
  ACTIVATED = 'plugin.activated',
  DEACTIVATED = 'plugin.deactivated',
  UNINSTALLED = 'plugin.uninstalled',
  ERROR = 'plugin.error',
}

export interface PluginEvent {
  type: PluginEventType
  pluginId: string
  pluginName: string
  organizationId: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface PluginEventListener {
  (event: PluginEvent): void | Promise<void>
}

/**
 * Plugin Event Emitter Interface
 * Allows subscribing to plugin lifecycle events
 */
export interface IPluginEventEmitter {
  /**
   * Emit a plugin event
   */
  emit(event: PluginEvent): void

  /**
   * Subscribe to plugin events
   * @param eventType Event type to listen for (or '*' for all events)
   * @param listener Event listener function
   * @returns Unsubscribe function
   */
  on(
    eventType: PluginEventType | '*',
    listener: PluginEventListener,
  ): () => void

  /**
   * Subscribe to a single occurrence of an event
   */
  once(
    eventType: PluginEventType | '*',
    listener: PluginEventListener,
  ): () => void

  /**
   * Remove an event listener
   */
  off(
    eventType: PluginEventType | '*',
    listener: PluginEventListener,
  ): void
}

export const PLUGIN_EVENT_EMITTER = Symbol('PLUGIN_EVENT_EMITTER')
