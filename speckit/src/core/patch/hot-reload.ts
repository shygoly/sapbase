// Hot reloading mechanism for schema changes
import { SchemaResolver } from '../schema/resolver'
import { SchemaRegistry } from '../schema/registry'

/**
 * Hot reloader for schema changes
 * Invalidates cache and triggers re-render without rebuild
 */
export class HotReloader {
  private schemaResolver: SchemaResolver
  private schemaRegistry: SchemaRegistry
  private reloadCallbacks: Set<() => void> = new Set()
  private debounceTimer: NodeJS.Timeout | null = null
  private readonly DEBOUNCE_MS = 300

  constructor(schemaResolver: SchemaResolver, schemaRegistry: SchemaRegistry) {
    this.schemaResolver = schemaResolver
    this.schemaRegistry = schemaRegistry
  }

  /**
   * Register a callback to be called when schemas are reloaded
   */
  onReload(callback: () => void): () => void {
    this.reloadCallbacks.add(callback)
    // Return unsubscribe function
    return () => {
      this.reloadCallbacks.delete(callback)
    }
  }

  /**
   * Invalidate cache for a specific schema
   */
  invalidateSchema(
    schemaType: 'object' | 'view' | 'page',
    schemaName: string
  ): void {
    // Clear from registry
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- key reserved for future registry delete
    const _key = `${schemaType}:${schemaName}`
    // Note: SchemaRegistry doesn't have a delete method, so we'll need to reload
    // For now, we'll trigger a full reload

    // Debounce reload calls
    this.debounceReload()
  }

  /**
   * Invalidate all caches
   */
  invalidateAll(): void {
    // Clear registry
    this.schemaRegistry.clear()

    // Debounce reload calls
    this.debounceReload()
  }

  /**
   * Trigger reload callbacks (debounced)
   */
  private debounceReload(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.triggerReload()
      this.debounceTimer = null
    }, this.DEBOUNCE_MS)
  }

  /**
   * Trigger all reload callbacks
   */
  private triggerReload(): void {
    for (const callback of Array.from(this.reloadCallbacks)) {
      try {
        callback()
      } catch (error) {
        // Callback error swallowed to avoid breaking other callbacks
      }
    }
  }

  /**
   * Force immediate reload (bypass debounce)
   */
  forceReload(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.triggerReload()
  }
}

/**
 * React hook for hot reloading (to be used in components)
 * This is a placeholder - actual React hook should be in a separate hooks file
 */
export function useHotReload(
  hotReloader: HotReloader,
  _dependencies: any[] = [] // eslint-disable-line @typescript-eslint/no-unused-vars
): void {
  // This would be implemented in a React hooks file
  // For now, it's a placeholder
  if (typeof window !== 'undefined') {
    // Client-side only
    const reload = () => {
      // Trigger React re-render by updating state
      // This would need to be integrated with React state management
    }
    hotReloader.onReload(reload)
  }
}
