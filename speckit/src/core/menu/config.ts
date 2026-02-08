export interface MenuItem {
  id: string
  label: string
  path?: string
  icon?: string
  children?: MenuItem[]
  permissions?: string[]
  visible?: boolean
}

export interface MenuConfig {
  items: MenuItem[]
}

export const defaultMenuConfig: MenuConfig = {
  items: [
    {
      id: 'dashboard',
      label: 'navigation.dashboard',
      path: '/admin/dashboard',
      icon: 'LayoutDashboard',
      permissions: ['view:dashboard'],
    },
    {
      id: 'users',
      label: 'navigation.users',
      path: '/admin/users',
      icon: 'Users',
      permissions: ['view:users'],
    },
    {
      id: 'roles',
      label: 'navigation.roles',
      path: '/admin/roles',
      icon: 'Shield',
      permissions: ['view:roles'],
    },
    {
      id: 'departments',
      label: 'navigation.departments',
      path: '/admin/departments',
      icon: 'Building2',
      permissions: ['view:departments'],
    },
    {
      id: 'audit',
      label: 'Audit Logs',
      path: '/admin/audit-logs',
      icon: 'FileText',
      permissions: ['view:audit_logs'],
    },
    {
      id: 'settings',
      label: 'navigation.settings',
      path: '/admin/settings',
      icon: 'Settings',
      permissions: ['view:settings'],
    },
  ],
}
