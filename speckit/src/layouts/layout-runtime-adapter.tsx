/**
 * Layout Runtime Adapter
 * Bridges template layout components with Speckit Runtime
 * Ensures template components work seamlessly with Speckit's auth/menu/permission system
 */

'use client';

import React from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { UnifiedSidebar } from '@/components/layout/unified-sidebar';
import Header from '@/components/layout/header';
import { useRequireAuth } from '@/core/auth/auth-hooks';
import { usePermissionStore } from '@/core/store';
import { AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LayoutRuntimeAdapterProps {
  children: React.ReactNode;
  /**
   * Minimum permissions required to access this layout
   * User must have at least one of these permissions
   */
  requiredPermissions?: string[];
  /**
   * Whether to require all permissions (AND) or any permission (OR)
   * @default false (OR - user needs any permission)
   */
  requireAll?: boolean;
  /**
   * Custom access denied fallback
   */
  accessDeniedFallback?: React.ReactNode;
  /**
   * Whether to show loading state during auth check
   */
  showLoading?: boolean;
}

/**
 * LayoutRuntimeAdapter - Wraps admin layout with Runtime integration
 * 
 * Responsibilities:
 * - Connects app-sidebar to MenuProvider (via UnifiedSidebar)
 * - Connects header to AuthProvider (via Header component)
 * - Enforces RBAC filtering
 * - Handles auth state
 */
export function LayoutRuntimeAdapter({
  children,
  requiredPermissions = [],
  requireAll = false,
  accessDeniedFallback,
  showLoading = true,
}: LayoutRuntimeAdapterProps) {
  const { isAuthenticated, isLoading } = useRequireAuth();
  const { hasPermission, hasAllPermissions, hasAnyPermission } = usePermissionStore();
  const router = useRouter();
  
  // Add debug logging
  React.useEffect(() => {
    console.log('LayoutRuntimeAdapter - Auth state:', { isAuthenticated, isLoading })
  }, [isAuthenticated, isLoading])

  // Check permissions if required
  const hasAccess = React.useMemo(() => {
    if (requiredPermissions.length === 0) return true;
    
    if (requireAll) {
      return hasAllPermissions(requiredPermissions);
    } else {
      return hasAnyPermission(requiredPermissions);
    }
  }, [requiredPermissions, requireAll, hasAllPermissions, hasAnyPermission]);

  // Loading state
  if (isLoading && showLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - useRequireAuth will redirect
  if (!isAuthenticated) {
    return null;
  }

  // Access denied
  if (!hasAccess) {
    if (accessDeniedFallback) {
      return <>{accessDeniedFallback}</>;
    }

    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="rounded-lg bg-white p-8 shadow-lg">
          <div className="flex items-center justify-center">
            <AlertCircle className="h-12 w-12 text-red-500" />
          </div>
          <h1 className="mt-4 text-center text-xl font-semibold text-gray-900">
            Access Denied
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            You do not have permission to access this area.
          </p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Render layout with Runtime integration
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-gray-50">
        <UnifiedSidebar source="api" />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto px-4 py-8">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
