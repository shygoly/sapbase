/**
 * Navigation Adapter
 * Integrates template's RBAC navigation with Speckit's auth system
 */

import { NavItem, AccessControl } from '@/types/nav';
import { PermissionGuard, PermissionContext } from '@/core/auth/permission-guard';
import { User } from '@/core/auth/types';

/**
 * Check if user has access to a navigation item
 */
export function canAccessNavItem(
  item: NavItem,
  context: PermissionContext
): boolean {
  const permissionGuard = new PermissionGuard(context);
  // If no access control is defined, allow access
  if (!item.access) {
    return true;
  }

  // If user is not authenticated and access is required, deny
  if (!context.user && item.access.requireOrg) {
    return false;
  }

  // Check role-based access
  if (item.access.role) {
    if (!permissionGuard.hasRole(item.access.role)) {
      return false;
    }
  }

  // Check multiple roles (any role grants access)
  if (item.access.roles && item.access.roles.length > 0) {
    if (!permissionGuard.hasAnyRole(item.access.roles)) {
      return false;
    }
  }

  // Check permission-based access
  if (item.access.permission) {
    if (!permissionGuard.has(item.access.permission)) {
      return false;
    }
  }

  // Check feature flag (placeholder for future feature flag system)
  if (item.access.feature) {
    // TODO: Integrate with feature flag system
    // For now, allow all features
  }

  // Check plan level (placeholder for future plan system)
  if (item.access.plan) {
    // TODO: Integrate with plan/subscription system
    // For now, allow all plans
  }

  return true;
}

/**
 * Filter navigation items based on user permissions
 */
export function filterNavByPermissions(
  items: NavItem[],
  context: PermissionContext
): NavItem[] {
  return items
    .filter((item) => canAccessNavItem(item, context))
    .map((item) => ({
      ...item,
      children: item.children
        ? filterNavByPermissions(
            item.children as NavItem[],
            context
          )
        : undefined,
    }))
    .filter((item) => {
      // Remove items with no children and no path
      if (!item.path && (!item.children || item.children.length === 0)) {
        return false;
      }
      return true;
    });
}

/**
 * Get accessible navigation items for current user
 */
export function getAccessibleNav(
  navConfig: NavItem[],
  context: PermissionContext
): NavItem[] {
  return filterNavByPermissions(navConfig, context);
}
