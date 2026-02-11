import { NavItem, NavConfig } from '@/types';

/**
 * Navigation configuration with RBAC support
 *
 * This configuration is used for both the sidebar navigation and Cmd+K bar.
 *
 * RBAC Access Control:
 * Each navigation item can have an `access` property that controls visibility
 * based on permissions, plans, features, roles, and organization context.
 *
 * Examples:
 *
 * 1. Require organization:
 *    access: { requireOrg: true }
 *
 * 2. Require specific permission:
 *    access: { requireOrg: true, permission: 'org:teams:manage' }
 *
 * 3. Require specific plan:
 *    access: { plan: 'pro' }
 *
 * 4. Require specific feature:
 *    access: { feature: 'premium_access' }
 *
 * 5. Require specific role:
 *    access: { role: 'admin' }
 *
 * 6. Multiple conditions (all must be true):
 *    access: { requireOrg: true, permission: 'org:teams:manage', plan: 'pro' }
 */
const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard/overview',
    icon: 'dashboard',
    children: [],
  },
  {
    id: 'workspaces',
    label: 'Workspaces',
    path: '/dashboard/workspaces',
    icon: 'workspace',
    children: [],
  },
  {
    id: 'account',
    label: 'Account',
    icon: 'account',
    children: [
      {
        id: 'profile',
        label: 'Profile',
        path: '/dashboard/profile',
        icon: 'profile',
      },
      {
        id: 'billing',
        label: 'Billing',
        path: '/dashboard/billing',
        icon: 'billing',
        // Only show billing if in organization context
        access: { requireOrg: true },
      },
      {
        id: 'login',
        label: 'Login',
        path: '/',
        icon: 'login',
      },
    ],
  },
];

export const NAV_CONFIG: NavConfig = {
  items: navItems,
  defaultPath: '/dashboard/overview',
};
