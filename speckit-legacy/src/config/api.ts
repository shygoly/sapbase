// API configuration and endpoints

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export const API_ENDPOINTS = {
  // Auth
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    profile: '/auth/profile',
  },

  // Users
  users: {
    list: '/users',
    create: '/users',
    detail: (id: string) => `/users/${id}`,
    update: (id: string) => `/users/${id}`,
    delete: (id: string) => `/users/${id}`,
  },

  // Roles
  roles: {
    list: '/roles',
    create: '/roles',
    detail: (id: string) => `/roles/${id}`,
    update: (id: string) => `/roles/${id}`,
    delete: (id: string) => `/roles/${id}`,
  },

  // Departments
  departments: {
    list: '/departments',
    create: '/departments',
    detail: (id: string) => `/departments/${id}`,
    update: (id: string) => `/departments/${id}`,
    delete: (id: string) => `/departments/${id}`,
  },

  // Audit Logs
  auditLogs: {
    list: '/audit-logs',
    detail: (id: string) => `/audit-logs/${id}`,
    export: '/audit-logs/export',
  },

  // Settings
  settings: {
    list: '/settings',
    get: (key: string) => `/settings/${key}`,
    update: (key: string) => `/settings/${key}`,
  },

  // Permissions
  permissions: {
    list: '/permissions',
    check: '/permissions/check',
  },
}

export function getApiUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint}`
}
