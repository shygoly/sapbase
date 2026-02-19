/**
 * Default menu items for the application
 * This includes both existing system features and CRM module
 */
import { UnifiedMenuItem } from '@/types/navigation'

export const defaultMenuItems: UnifiedMenuItem[] = [
  {
    id: 'dashboard',
    label: '仪表板',
    path: '/dashboard/overview',
    icon: 'dashboard',
    order: 1,
  },
  {
    id: 'crm',
    label: 'CRM管理',
    icon: 'users',
    order: 2,
    children: [
      {
        id: 'crm-customers',
        label: '客户管理',
        path: '/crm/customers',
        icon: 'users',
        order: 1,
        permissions: ['admin', 'sales', 'manager'],
      },
      {
        id: 'crm-orders',
        label: '订单管理',
        path: '/crm/orders',
        icon: 'shopping',
        order: 2,
        permissions: ['admin', 'sales', 'manager'],
      },
      {
        id: 'crm-transactions',
        label: '资金往来',
        path: '/crm/transactions',
        icon: 'dollar',
        order: 3,
        permissions: ['admin', 'sales', 'manager', 'accountant'],
      },
    ],
  },
  {
    id: 'admin',
    label: '系统管理',
    icon: 'settings',
    order: 3,
    children: [
      {
        id: 'admin-users',
        label: '用户管理',
        path: '/admin/users',
        icon: 'users',
        order: 1,
        permissions: ['admin'],
      },
      {
        id: 'admin-departments',
        label: '科室管理',
        path: '/admin/departments',
        icon: 'building',
        order: 2,
        permissions: ['admin'],
      },
      {
        id: 'admin-roles',
        label: '角色权限',
        path: '/admin/roles',
        icon: 'shield',
        order: 3,
        permissions: ['admin'],
      },
      {
        id: 'admin-menu',
        label: '菜单管理',
        path: '/admin/menu',
        icon: 'menu',
        order: 4,
        permissions: ['admin'],
      },
      {
        id: 'admin-audit-logs',
        label: '审计日志',
        path: '/admin/audit-logs',
        icon: 'history',
        order: 5,
        permissions: ['admin'],
      },
      {
        id: 'admin-plugins',
        label: '插件管理',
        path: '/admin/plugins',
        icon: 'settings',
        order: 6,
        permissions: ['admin'],
      },
      {
        id: 'admin-settings',
        label: '系统配置',
        path: '/admin/settings',
        icon: 'settings',
        order: 7,
        permissions: ['admin'],
      },
      {
        id: 'admin-workflows',
        label: '工作流',
        path: '/admin/workflows',
        icon: 'workflow',
        order: 8,
        permissions: ['admin'],
      },
      {
        id: 'admin-brand-config',
        label: '品牌配置',
        path: '/admin/organization/brand-config',
        icon: 'settings',
        order: 9,
        permissions: ['admin'],
      },
    ],
  },
]
