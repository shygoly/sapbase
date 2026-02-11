/**
 * Permission Hooks
 * Custom hooks for permission checking
 */

import { usePermissionStore } from '@/core/store'

/**
 * usePermission - Check if user has a specific permission
 */
export function usePermission(permission: string): boolean {
  const { hasPermission } = usePermissionStore()
  return hasPermission(permission)
}

/**
 * useCanPerform - Check if user can perform an action on a resource
 * @param resource - Resource name (e.g., 'users', 'roles')
 * @param action - Action name (e.g., 'create', 'read', 'update', 'delete')
 */
export function useCanPerform(resource: string, action: string): boolean {
  const { canPerformAction } = usePermissionStore()
  return canPerformAction(resource, action)
}

/**
 * useUserPermissions - Get all user permissions
 */
export function useUserPermissions(): string[] {
  const { permissions } = usePermissionStore()
  return permissions
}

/**
 * useHasAnyPermission - Check if user has any of the given permissions
 */
export function useHasAnyPermission(permissions: string[]): boolean {
  const { hasAnyPermission } = usePermissionStore()
  return hasAnyPermission(permissions)
}

/**
 * useHasAllPermissions - Check if user has all of the given permissions
 */
export function useHasAllPermissions(permissions: string[]): boolean {
  const { hasAllPermissions } = usePermissionStore()
  return hasAllPermissions(permissions)
}
