import type { Plugin } from '../entities/plugin.entity'
import type { PluginPermissions } from '../entities/plugin-permission.entity'

/**
 * Plugin Context Interface
 * Provides controlled access to system services for plugins
 */
export interface IPluginContext {
  /**
   * Plugin metadata
   */
  readonly plugin: Plugin
  readonly permissions: PluginPermissions
  readonly organizationId: string

  /**
   * Database access service
   * Allows plugins to execute queries with permission checking
   */
  database: {
    /**
     * Execute a raw SQL query
     * @param table Table name (must be declared in permissions)
     * @param operation Operation type (read, write, delete)
     * @param query SQL query string
     * @param params Query parameters
     * @returns Query result
     */
    executeQuery: (
      table: string,
      operation: 'read' | 'write' | 'delete',
      query: string,
      params?: any[],
    ) => Promise<any>

    /**
     * Get a TypeORM repository for an entity
     * @param entityClass Entity class
     * @param tableName Table name (must be declared in permissions)
     * @returns Repository instance or null if permission denied
     */
    getRepository: <T>(
      entityClass: new () => T,
      tableName: string,
    ) => any | null
  }

  /**
   * Module registry access
   * Allows plugins to register or extend modules
   */
  modules: {
    /**
     * Register a new module
     * @param moduleName Module name
     * @param moduleDescription Module description
     * @param moduleType Optional module type
     * @returns Module ID
     */
    register: (
      moduleName: string,
      moduleDescription: string,
      moduleType?: string,
    ) => Promise<string>

    /**
     * Extend an existing module
     * @param moduleName Module name to extend
     * @param extensions Extension data
     */
    extend: (
      moduleName: string,
      extensions: Record<string, any>,
    ) => Promise<void>
  }

  /**
   * Logger for plugin operations
   */
  logger: {
    log: (message: string, ...args: any[]) => void
    error: (message: string, ...args: any[]) => void
    warn: (message: string, ...args: any[]) => void
    debug: (message: string, ...args: any[]) => void
  }

  /**
   * Plugin metadata helpers
   */
  metadata: {
    /**
     * Get plugin configuration from manifest
     */
    getConfig: () => Record<string, any>
    /**
     * Get plugin version
     */
    getVersion: () => string
    /**
     * Get plugin name
     */
    getName: () => string
  }
}
