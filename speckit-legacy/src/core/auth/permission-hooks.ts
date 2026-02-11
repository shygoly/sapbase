'use client'

import { useAuth } from './context'
import { PermissionGuard, RoutePermissionConfig } from './permission-guard'

export function usePermissionGuard() {
  const { user } = useAuth()

  const guard = new PermissionGuard({
    user: user as any,
    organizationId: user?.organizationId,
  })

  return guard
}

export function useCanAccess(permission: string | string[]): boolean {
  const guard = usePermissionGuard()

  if (Array.isArray(permission)) {
    return guard.hasAny(permission)
  }

  return guard.has(permission)
}

export function useCanAccessRoute(config: RoutePermissionConfig): boolean {
  const guard = usePermissionGuard()
  return guard.canAccessRoute(config)
}

export function useCanPerformOperation(resource: string, action: string): boolean {
  const guard = usePermissionGuard()
  return guard.canPerformOperation(resource, action)
}

export function useCanPerformBatchOperation(
  resource: string,
  action: string,
  count: number
): boolean {
  const guard = usePermissionGuard()
  return guard.canPerformBatchOperation(resource, action, count)
}

export function useHasRole(role: string | string[]): boolean {
  const guard = usePermissionGuard()

  if (Array.isArray(role)) {
    return guard.hasAnyRole(role)
  }

  return guard.hasRole(role)
}
