'use client'

import { ReactNode } from 'react'
import { useCanAccess, useHasRole } from '@/core/auth/permission-hooks'

interface PermissionGateProps {
  children: ReactNode
  permission?: string | string[]
  role?: string | string[]
  requireAll?: boolean
  fallback?: ReactNode
}

export function PermissionGate({
  children,
  permission,
  role,
  requireAll = false,
  fallback = null,
}: PermissionGateProps) {
  let hasAccess = true

  // Check permission
  if (permission) {
    if (Array.isArray(permission)) {
      hasAccess = requireAll
        ? permission.every(p => useCanAccess(p))
        : permission.some(p => useCanAccess(p))
    } else {
      hasAccess = useCanAccess(permission)
    }
  }

  // Check role
  if (role && hasAccess) {
    if (Array.isArray(role)) {
      hasAccess = role.some(r => useHasRole(r))
    } else {
      hasAccess = useHasRole(role)
    }
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>
}
