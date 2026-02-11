/**
 * API Types - Shared with backend via shared-schemas
 */

// ============ Common Types ============

export enum EntityStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum AuditAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
}

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'execute'
export type PermissionResource = 'users' | 'roles' | 'departments' | 'settings' | 'audit-logs'
export type PermissionString = `${PermissionResource}:${PermissionAction}`

export interface BaseEntity {
  id: string
  createdAt: Date
  updatedAt: Date
}

export interface BaseAuditEntity extends BaseEntity {
  createdBy?: string
  updatedBy?: string
}

// ============ Pagination ============

export interface PaginationParams {
  page: number
  limit: number
  offset?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ============ API Response ============

export interface ApiResponse<T> {
  data: T
  status: number
  message?: string
}

export interface ApiErrorResponse {
  status: number
  message: string
  error?: string
  details?: Record<string, any>
}

// ============ Auth ============

export interface User extends BaseAuditEntity {
  name: string
  email: string
  role: string
  status: UserStatus
  department?: string
  permissions: string[]
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  user: User
}

export interface AuthUser extends User {
  permissions: string[]
}

// ============ Role ============

export interface Role extends BaseAuditEntity {
  name: string
  description?: string
  permissions: string[]
  status: EntityStatus
}

export interface CreateRoleInput {
  name: string
  description?: string
  permissions?: string[]
  status?: EntityStatus
}

export interface UpdateRoleInput {
  name?: string
  description?: string
  permissions?: string[]
  status?: EntityStatus
}

// ============ Permission ============

export interface Permission extends BaseAuditEntity {
  resource: PermissionResource
  action: PermissionAction
  description?: string
}

export interface PermissionGroup {
  id: string
  name: string
  permissions: Permission[]
}

export interface CreatePermissionInput {
  resource: PermissionResource
  action: PermissionAction
  description?: string
}

export interface UpdatePermissionInput {
  description?: string
}

// ============ Department ============

export interface Department extends BaseAuditEntity {
  name: string
  description?: string
  parentId?: string
  status: EntityStatus
}

export interface CreateDepartmentInput {
  name: string
  description?: string
  parentId?: string
  status?: EntityStatus
}

export interface UpdateDepartmentInput {
  name?: string
  description?: string
  parentId?: string
  status?: EntityStatus
}

// ============ Menu ============

export interface MenuItem extends BaseAuditEntity {
  label: string
  path?: string
  icon?: string
  permissions?: string[]
  visible: boolean
  order: number
  parent?: MenuItem
  children?: MenuItem[]
}

// ============ Audit Log ============

export interface AuditLog extends BaseEntity {
  userId: string
  action: AuditAction
  resourceType: string
  resourceId: string
  changes?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  status: 'success' | 'failure'
  errorMessage?: string
}

export interface AuditLogFilter {
  userId?: string
  action?: AuditAction
  resourceType?: string
  resourceId?: string
  startDate?: Date
  endDate?: Date
  status?: 'success' | 'failure'
}

// ============ Settings ============

export interface Setting extends BaseAuditEntity {
  userId: string
  key: string
  value: any
}

export interface CreateSettingInput {
  key: string
  value: any
}

export interface UpdateSettingInput {
  key?: string
  value?: any
}
