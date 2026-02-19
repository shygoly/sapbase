import type { PluginPermissions } from '../entities/plugin-permission.entity'

/**
 * Service interface: Permission Checker
 */
export interface IPermissionChecker {
  checkApiPermission(
    permissions: PluginPermissions,
    endpoint: string,
    method: string,
  ): boolean
  checkDatabasePermission(
    permissions: PluginPermissions,
    table: string,
    operation: 'read' | 'write' | 'delete',
  ): boolean
  checkModulePermission(
    permissions: PluginPermissions,
    action: 'extend' | 'create',
    moduleName?: string,
  ): boolean
}

export const PERMISSION_CHECKER = Symbol('IPermissionChecker')
