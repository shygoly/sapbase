import { Injectable, Logger } from '@nestjs/common'
import type { Plugin } from '../../domain/entities/plugin.entity'
import { PluginPermissions } from '../../domain/entities/plugin-permission.entity'
import type { IPluginContext } from '../../domain/services/i-plugin-context'
import { PluginDatabaseAccessService } from '../database/plugin-database-access.service'
import { PluginModuleIntegrationService } from '../../application/services/plugin-module-integration.service'

/**
 * Plugin Context Provider
 * Creates and provides plugin context instances for plugin execution
 */
@Injectable()
export class PluginContextProvider {
  private readonly logger = new Logger(PluginContextProvider.name)

  constructor(
    private readonly databaseAccess: PluginDatabaseAccessService,
    private readonly moduleIntegration: PluginModuleIntegrationService,
  ) {}

  /**
   * Create a plugin context for a given plugin
   */
  createContext(plugin: Plugin): IPluginContext {
    const permissions = PluginPermissions.fromManifest(
      plugin.manifest.permissions || {},
    )

    const pluginLogger = {
      log: (message: string, ...args: any[]) => {
        this.logger.log(`[Plugin:${plugin.name}] ${message}`, ...args)
      },
      error: (message: string, ...args: any[]) => {
        this.logger.error(`[Plugin:${plugin.name}] ${message}`, ...args)
      },
      warn: (message: string, ...args: any[]) => {
        this.logger.warn(`[Plugin:${plugin.name}] ${message}`, ...args)
      },
      debug: (message: string, ...args: any[]) => {
        this.logger.debug(`[Plugin:${plugin.name}] ${message}`, ...args)
      },
    }

    const context: IPluginContext = {
      plugin,
      permissions,
      organizationId: plugin.organizationId,

      database: {
        executeQuery: async (
          table: string,
          operation: 'read' | 'write' | 'delete',
          query: string,
          params?: any[],
        ) => {
          return await this.databaseAccess.executeQuery(
            permissions,
            table,
            operation,
            query,
            params,
            plugin.organizationId,
          )
        },
        getRepository: <T>(
          entityClass: new () => T,
          tableName: string,
        ) => {
          return this.databaseAccess.getRepository(
            permissions,
            entityClass as new () => import('typeorm').ObjectLiteral,
            tableName,
          ) as any
        },
      },

      modules: {
        register: async (
          moduleName: string,
          moduleDescription: string,
          moduleType?: string,
        ) => {
          return await this.moduleIntegration.registerModuleFromPlugin({
            pluginId: plugin.id,
            organizationId: plugin.organizationId,
            moduleName,
            moduleDescription,
            moduleType,
          })
        },
        extend: async (
          moduleName: string,
          extensions: Record<string, any>,
        ) => {
          return await this.moduleIntegration.extendModuleFromPlugin(
            plugin.id,
            plugin.organizationId,
            moduleName,
            extensions,
          )
        },
      },

      logger: pluginLogger,

      metadata: {
        getConfig: () => plugin.manifest.config || {},
        getVersion: () => plugin.version,
        getName: () => plugin.name,
      },
    }

    return context
  }
}
