/**
 * Common types and enums shared across Speckit ERP
 */

// Status enums
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

// Base entity types
export interface BaseEntity {
  id: string
  createdAt: Date
  updatedAt: Date
}

export interface BaseAuditEntity extends BaseEntity {
  createdBy?: string
  updatedBy?: string
}

// Pagination
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

// API Response
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

// Permission types
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'execute'
export type PermissionResource = 'users' | 'roles' | 'departments' | 'settings' | 'audit-logs'
export type PermissionString = `${PermissionResource}:${PermissionAction}`
