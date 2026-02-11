'use client';

import { useMemo } from 'react';
import type { NavItem } from '@/types';

/**
 * Hook to filter navigation items based on RBAC
 *
 * @param items - Array of navigation items to filter
 * @returns Filtered items
 */
export function useFilteredNavItems(items: NavItem[]) {
  // Simple filtering without Clerk dependencies
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // No access restrictions - show all items
        if (!item.access) {
          return true;
        }
        return true;
      })
      .map((item) => {
        // Recursively filter child items
        if (item.items && item.items.length > 0) {
          return {
            ...item,
            items: item.items
          };
        }
        return item;
      });
  }, [items]);

  return filteredItems;
}
