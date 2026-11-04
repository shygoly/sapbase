import { Injectable } from '@nestjs/common'
import { PluginPermissions } from '../../domain/entities/plugin-permission.entity'
import type { IPermissionChecker } from '../../domain/services'

@Injectable()
export class PermissionCheckerService implements IPermissionChecker {
  checkApiPermission(
    permissions: PluginPermissions,
    endpoint: string,
    method: string,
  ): boolean {
    return permissions.hasApiAccess(endpoint, method)
  }

  checkDatabasePermission(
    permissions: PluginPermissions,
    table: string,
    operation: 'read' | 'write' | 'delete',
  ): boolean {
    return permissions.hasDatabaseAccess(table, operation)
  }

  checkModulePermission(
    permissions: PluginPermissions,
    action: 'extend' | 'create',
    moduleName?: string,
  ): boolean {
    if (action === 'create') {
      return permissions.canCreateModule()
    }
    if (action === 'extend' && moduleName) {
      return permissions.canExtendModule(moduleName)
    }
    return false
  }
}
