'use client'

import { ReactNode } from 'react'
import { usePermission } from '@/core/auth/hooks'

interface ProtectedRouteProps {
  children: ReactNode
  requiredPermission?: string
  requiredPermissions?: string[]
  requireAll?: boolean
}

export function ProtectedRoute({
  children,
  requiredPermission,
  requiredPermissions,
  requireAll = false,
}: ProtectedRouteProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermission()

  // Check single permission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <div className="p-4 text-red-600">Access Denied: Insufficient permissions</div>
  }

  // Check multiple permissions
  if (requiredPermissions) {
    const hasAccess = requireAll
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions)

    if (!hasAccess) {
      return <div className="p-4 text-red-600">Access Denied: Insufficient permissions</div>
    }
  }

  return <>{children}</>
}
