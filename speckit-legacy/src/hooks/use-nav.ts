'use client';

import { useMemo } from 'react';
import { useAuth } from '@/core/auth/hooks';
import { PermissionContext } from '@/core/auth/permission-guard';
import { getAccessibleNav } from '@/core/navigation/nav-adapter';
import { NAV_CONFIG } from '@/config/nav-config';
import { NavItem } from '@/types/nav';

/**
 * Hook to get accessible navigation items based on user permissions
 */
export function useNav() {
  const { user } = useAuth();

  // Create permission context
  const context: PermissionContext = useMemo(() => ({
    user,
  }), [user]);

  // Filter navigation items based on permissions
  const items = useMemo(() => {
    return getAccessibleNav(NAV_CONFIG.items, context);
  }, [context]);

  return {
    items,
    user,
    context,
  };
}
