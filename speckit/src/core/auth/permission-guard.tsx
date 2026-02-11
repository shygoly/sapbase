/**
 * Permission Guard Component
 * Conditionally renders children based on user permissions
 */

import React from 'react'
import { usePermissionStore } from '@/core/store'

interface PermissionGuardProps {
  permission?: string
  permissions?: string[]
  requireAll?: boolean
  fallback?: React.ReactNode
  children: React.ReactNode
}

/**
 * PermissionGuard - Check single or multiple permissions
 * @param permission - Single permission to check
 * @param permissions - Multiple permissions to check
 * @param requireAll - If true, user must have ALL permissions. If false, user must have ANY permission
 * @param fallback - Component to render if permission check fails
 * @param children - Component to render if permission check passes
 */
export function PermissionGuard({
  permission,
  permissions,
  requireAll = false,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { hasPermission, hasAllPermissions, hasAnyPermission } = usePermissionStore()

  let hasAccess = false

  if (permission) {
    hasAccess = hasPermission(permission)
  } else if (permissions && permissions.length > 0) {
    hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions)
  }

  return <>{hasAccess ? children : fallback}</>
}

/**
 * withPermission - HOC for permission-protected components
 */
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  permission: string,
  fallback?: React.ReactNode,
) {
  return function ProtectedComponent(props: P) {
    return (
      <PermissionGuard permission={permission} fallback={fallback}>
        <Component {...props} />
      </PermissionGuard>
    )
  }
}
