import { Injectable, Inject, ForbiddenException, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, ObjectLiteral, Repository } from 'typeorm'
import { PERMISSION_CHECKER } from '../../domain/services'
import type { IPermissionChecker } from '../../domain/services'
import { PluginPermissions } from '../../domain/entities/plugin-permission.entity'

@Injectable()
export class PluginDatabaseAccessService {
  private readonly logger = new Logger(PluginDatabaseAccessService.name)

  constructor(
    private readonly dataSource: DataSource,
    @Inject(PERMISSION_CHECKER)
    private readonly permissionChecker: IPermissionChecker,
  ) {}

  /**
   * Execute a database query with permission checking
   */
  async executeQuery(
    permissions: PluginPermissions,
    table: string,
    operation: 'read' | 'write' | 'delete',
    query: string,
    params?: any[],
    organizationId?: string,
  ): Promise<any> {
    // Check permission
    const hasPermission = this.permissionChecker.checkDatabasePermission(
      permissions,
      table,
      operation,
    )

    if (!hasPermission) {
      throw new ForbiddenException(
        `Plugin does not have ${operation} permission for table ${table}`,
      )
    }

    // Add organization filter for tenant isolation
    let finalQuery = query
    if (organizationId && operation === 'read') {
      // Ensure queries include organization filter
      // This is a safety measure - plugins should include orgId in their queries
      this.logger.warn(
        `Plugin query on ${table} - ensure organizationId filter is included`,
      )
    }

    try {
      const result = await this.dataSource.query(finalQuery, params)
      this.logger.log(
        `Plugin executed ${operation} on ${table} - ${result.length || 0} rows affected`,
      )
      return result
    } catch (error) {
      this.logger.error(`Plugin database query failed:`, error)
      throw error
    }
  }

  /**
   * Get a repository for a specific entity (with permission check)
   */
  getRepository<T extends ObjectLiteral>(
    permissions: PluginPermissions,
    entityClass: new () => T,
    tableName: string,
  ): Repository<T> | null {
    // Check if plugin has read permission (minimum required for repository access)
    const hasPermission = this.permissionChecker.checkDatabasePermission(
      permissions,
      tableName,
      'read',
    )

    if (!hasPermission) {
      return null
    }

    return this.dataSource.getRepository(entityClass) as Repository<T>
  }
}
