/**
 * Navigation Types
 * Types for RBAC-based navigation system
 */

import { MenuItem } from '@/core/menu/config';

/**
 * Access control configuration for navigation items
 */
export interface AccessControl {
  /**
   * Require organization context
   */
  requireOrg?: boolean;

  /**
   * Required permission (e.g., 'org:teams:manage')
   */
  permission?: string;

  /**
   * Required plan level (e.g., 'pro', 'enterprise')
   */
  plan?: string;

  /**
   * Required feature flag (e.g., 'premium_access')
   */
  feature?: string;

  /**
   * Required role (e.g., 'admin', 'owner')
   */
  role?: string;

  /**
   * Multiple roles (any of these roles grants access)
   */
  roles?: string[];
}

/**
 * Navigation item with RBAC support
 * Extends MenuItem with access control properties
 */
export interface NavItem extends Omit<MenuItem, 'children'> {
  /**
   * Access control configuration
   */
  access?: AccessControl;

  /**
   * Badge text (e.g., 'New', 'Pro')
   */
  badge?: string;

  /**
   * External link flag
   */
  external?: boolean;

  /**
   * Disabled state
   */
  disabled?: boolean;

  /**
   * Child navigation items (override MenuItem children to use NavItem[])
   */
  children?: NavItem[];
}

/**
 * Navigation configuration
 */
export interface NavConfig {
  items: NavItem[];
  defaultPath?: string;
}
