/**
 * Permissions schema definitions
 */

import { BaseAuditEntity, PermissionAction, PermissionResource } from './common'

export interface Permission extends BaseAuditEntity {
  resource: PermissionResource
  action: PermissionAction
  description?: string
}

export interface PermissionGroup {
  id: string
  name: string
  permissions: Permission[]
}

export interface RolePermission {
  roleId: string
  permissionId: string
}

export interface UserPermission {
  userId: string
  permissionId: string
}

export interface CreatePermissionInput {
  resource: PermissionResource
  action: PermissionAction
  description?: string
}

export interface UpdatePermissionInput {
  description?: string
}

export interface PermissionCheck {
  resource: PermissionResource
  action: PermissionAction
}
