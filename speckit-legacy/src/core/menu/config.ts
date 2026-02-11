export interface MenuItem {
  id: string
  label: string
  path?: string
  icon?: string
  children?: MenuItem[]
  permissions?: string[]
  visible?: boolean
  group?: string
  order?: number
}

export interface MenuGroup {
  id: string
  label: string
  order: number
}

export interface MenuConfig {
  items: MenuItem[]
}

export const menuGroups: MenuGroup[] = [
  { id: 'main', label: 'Main Navigation', order: 1 },
  { id: 'user-management', label: 'User Management', order: 2 },
  { id: 'system', label: 'System Management', order: 99 },
]

export const defaultMenuConfig: MenuConfig = {
  items: [
    {
      id: 'dashboard',
      label: 'navigation.dashboard',
      path: '/admin/dashboard',
      icon: 'LayoutDashboard',
      permissions: ['view:dashboard'],
      group: 'main',
      order: 1,
    },
    {
      id: 'users',
      label: 'navigation.users',
      path: '/admin/users',
      icon: 'Users',
      permissions: ['view:users'],
      group: 'user-management',
      order: 1,
    },
    {
      id: 'roles',
      label: 'navigation.roles',
      path: '/admin/roles',
      icon: 'Shield',
      permissions: ['view:roles'],
      group: 'user-management',
      order: 2,
    },
    {
      id: 'departments',
      label: 'navigation.departments',
      path: '/admin/departments',
      icon: 'Building2',
      permissions: ['view:departments'],
      group: 'user-management',
      order: 3,
    },
    {
      id: 'audit',
      label: 'Audit Logs',
      path: '/admin/audit-logs',
      icon: 'FileText',
      permissions: ['view:audit_logs'],
      group: 'system',
      order: 1,
    },
    {
      id: 'settings',
      label: 'navigation.settings',
      path: '/admin/settings',
      icon: 'Settings',
      permissions: ['view:settings'],
      group: 'system',
      order: 2,
    },
  ],
}
