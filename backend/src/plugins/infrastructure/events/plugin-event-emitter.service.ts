import { Injectable, Logger } from '@nestjs/common'
import type {
  IPluginEventEmitter,
  PluginEvent,
  PluginEventType,
  PluginEventListener,
} from '../../domain/services/i-plugin-event-emitter'

/**
 * Plugin Event Emitter Service
 * Implements event system for plugin lifecycle events
 */
@Injectable()
export class PluginEventEmitterService implements IPluginEventEmitter {
  private readonly logger = new Logger(PluginEventEmitterService.name)
  private readonly listeners = new Map<
    PluginEventType | '*',
    Set<PluginEventListener>
  >()

  emit(event: PluginEvent): void {
    this.logger.debug(
      `Emitting plugin event: ${event.type} for plugin ${event.pluginName}`,
    )

    // Notify listeners for specific event type
    const specificListeners = this.listeners.get(event.type)
    if (specificListeners) {
      for (const listener of specificListeners) {
        try {
          const result = listener(event)
          // Handle async listeners
          if (result instanceof Promise) {
            result.catch((error) => {
              this.logger.error(
                `Error in plugin event listener for ${event.type}:`,
                error,
              )
            })
          }
        } catch (error) {
          this.logger.error(
            `Error in plugin event listener for ${event.type}:`,
            error,
          )
        }
      }
    }

    // Notify wildcard listeners
    const wildcardListeners = this.listeners.get('*')
    if (wildcardListeners) {
      for (const listener of wildcardListeners) {
        try {
          const result = listener(event)
          if (result instanceof Promise) {
            result.catch((error) => {
              this.logger.error(
                `Error in plugin event listener for *:`,
                error,
              )
            })
          }
        } catch (error) {
          this.logger.error(`Error in plugin event listener for *:`, error)
        }
      }
    }
  }

  on(
    eventType: PluginEventType | '*',
    listener: PluginEventListener,
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }

    this.listeners.get(eventType)!.add(listener)

    // Return unsubscribe function
    return () => {
      this.off(eventType, listener)
    }
  }

  once(
    eventType: PluginEventType | '*',
    listener: PluginEventListener,
  ): () => void {
    const wrappedListener: PluginEventListener = (event) => {
      listener(event)
      this.off(eventType, wrappedListener)
    }

    return this.on(eventType, wrappedListener)
  }

  off(
    eventType: PluginEventType | '*',
    listener: PluginEventListener,
  ): void {
    const listeners = this.listeners.get(eventType)
    if (listeners) {
      listeners.delete(listener)
      if (listeners.size === 0) {
        this.listeners.delete(eventType)
      }
    }
  }
}
