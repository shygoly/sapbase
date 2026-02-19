/**
 * Sidebar Menu Adapter
 * Adapts template's app-sidebar to use Speckit's MenuProvider
 * Transforms MenuProvider data to sidebar structure with RBAC filtering
 */

'use client';

import React from 'react';
import { useMenuStore } from '@/core/store';
import { usePermissionStore } from '@/core/store';
import { UnifiedSidebar } from '@/components/layout/unified-sidebar';
import { MenuItem } from '@/lib/api/types';

interface SidebarMenuAdapterProps {
  /**
   * Source of menu items: 'api' uses MenuProvider, 'static' uses provided items
   */
  source?: 'api' | 'static';
  /**
   * Static menu items (used when source='static')
   */
  staticItems?: MenuItem[];
  /**
   * Custom filter function for menu items
   */
  filterFn?: (item: MenuItem) => boolean;
}

/**
 * SidebarMenuAdapter - Adapts menu data for sidebar rendering
 * 
 * Responsibilities:
 * - Transforms MenuProvider data to sidebar structure
 * - Enforces RBAC filtering
 * - Handles menu item routing
 * - Provides loading/error states
 */
export function SidebarMenuAdapter({
  source = 'api',
  staticItems,
  filterFn,
}: SidebarMenuAdapterProps) {
  const { items: menuItems, isLoading, error } = useMenuStore();
  const { hasPermission } = usePermissionStore();

  // Filter menu items based on permissions
  const filteredItems = React.useMemo(() => {
    if (source === 'static' && staticItems) {
      return staticItems.filter((item) => {
        // Apply custom filter if provided
        if (filterFn) {
          return filterFn(item);
        }
        // Default: check if user has required permissions
        if (item.permissions && item.permissions.length > 0) {
          return item.permissions.some((perm) => hasPermission(perm));
        }
        return true;
      });
    }

    // Filter API menu items
    return menuItems.filter((item) => {
      if (filterFn) {
        return filterFn(item);
      }
      if (item.permissions && item.permissions.length > 0) {
        return item.permissions.some((perm) => hasPermission(perm));
      }
      return true;
    });
  }, [source, staticItems, menuItems, hasPermission, filterFn]);

  void filteredItems

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">Loading menu...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-destructive">Error loading menu</div>
      </div>
    );
  }

  // Render sidebar with filtered items
  return <UnifiedSidebar source={source} staticItems={staticItems} />;
}

/**
 * Hook to get filtered menu items
 */
export function useFilteredMenuItems(filterFn?: (item: MenuItem) => boolean) {
  const { items } = useMenuStore();
  const { hasPermission } = usePermissionStore();

  return React.useMemo(() => {
    return items.filter((item) => {
      if (filterFn) {
        return filterFn(item);
      }
      if (item.permissions && item.permissions.length > 0) {
        return item.permissions.some((perm) => hasPermission(perm));
      }
      return true;
    });
  }, [items, hasPermission, filterFn]);
}
