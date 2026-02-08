'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/core/auth/context'
import { usePermissionGuard } from '@/core/auth/permission-hooks'
import type { RoutePermissionConfig } from '@/core/auth/permission-guard'
import { Card, CardContent } from '@/components/ui/card'

interface ProtectedRouteProps {
  children: ReactNode
  requiredPermission?: string
  requiredPermissions?: string[]
  requireAll?: boolean
  config?: RoutePermissionConfig
  fallback?: ReactNode
}

export function ProtectedRoute({
  children,
  requiredPermission,
  requiredPermissions,
  requireAll = false,
  config,
  fallback,
}: ProtectedRouteProps) {
  const { isAuthenticated } = useAuth()
  const guard = usePermissionGuard()
  const router = useRouter()

  if (!isAuthenticated) {
    router.push('/login')
    return null
  }

  let hasAccess = true

  // Check using new config-based approach
  if (config) {
    hasAccess = guard.canAccessRoute(config)
  } else {
    // Check single permission
    if (requiredPermission && !guard.has(requiredPermission)) {
      hasAccess = false
    }

    // Check multiple permissions
    if (requiredPermissions && hasAccess) {
      hasAccess = requireAll
        ? guard.hasAll(requiredPermissions)
        : guard.hasAny(requiredPermissions)
    }
  }

  if (!hasAccess) {
    return (
      fallback || (
        <div className="p-6">
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-6 text-center">
              <h2 className="text-lg font-semibold text-destructive mb-2">Access Denied</h2>
              <p className="text-destructive/80">
                You don't have permission to access this page.
              </p>
            </CardContent>
          </Card>
        </div>
      )
    )
  }

  return <>{children}</>
}
