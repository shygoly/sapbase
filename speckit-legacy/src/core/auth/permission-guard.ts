import type { User } from './types'

export interface PermissionContext {
  user: User | null
  organizationId?: string
}

export interface RoutePermissionConfig {
  path: string
  requiredPermissions?: string[]
  requiredAnyPermissions?: string[]
  roles?: string[]
}

export interface ResourcePermissionConfig {
  resource: string
  action: string
  requiredPermissions?: string[]
}

export class PermissionGuard {
  constructor(private context: PermissionContext) {}

  has(permission: string): boolean {
    if (!this.context.user) return false
    return this.context.user.permissions.includes(permission)
  }

  hasAll(permissions: string[]): boolean {
    return permissions.every(p => this.has(p))
  }

  hasAny(permissions: string[]): boolean {
    return permissions.some(p => this.has(p))
  }

  hasRole(role: string): boolean {
    if (!this.context.user) return false
    return this.context.user.role === role
  }

  hasAnyRole(roles: string[]): boolean {
    if (!this.context.user) return false
    return roles.includes(this.context.user.role)
  }

  canPerformAction(action: string, resourceState?: string): boolean {
    if (resourceState) {
      const statePermission = `${resourceState}.${action}`
      if (this.has(statePermission)) return true
    }
    return this.has(action)
  }

  canAccessResource(resource: any): boolean {
    if (!this.context.user) return false

    const user = this.context.user

    // Super admin can access all
    if (user.role === 'super_admin') return true

    // Check organization scope
    if (resource.organizationId && resource.organizationId !== user.organizationId) {
      return false
    }

    // Check department scope
    if (user.dataScope === 'department' && resource.departmentId) {
      return resource.departmentId === user.departmentId
    }

    // Check user scope (own data only)
    if (user.dataScope === 'self' && resource.createdBy) {
      return resource.createdBy === user.id
    }

    return true
  }

  // Route-level permission check
  canAccessRoute(config: RoutePermissionConfig): boolean {
    if (!this.context.user) return false

    // Check role-based access
    if (config.roles && !this.hasAnyRole(config.roles)) {
      return false
    }

    // Check required permissions (all must be present)
    if (config.requiredPermissions && !this.hasAll(config.requiredPermissions)) {
      return false
    }

    // Check any required permissions (at least one must be present)
    if (config.requiredAnyPermissions && !this.hasAny(config.requiredAnyPermissions)) {
      return false
    }

    return true
  }

  // Component-level permission check
  canRenderComponent(permission: string | string[]): boolean {
    if (Array.isArray(permission)) {
      return this.hasAny(permission)
    }
    return this.has(permission)
  }

  // Operation-level permission check
  canPerformOperation(resource: string, action: string): boolean {
    const permission = `${resource}:${action}`
    return this.has(permission)
  }

  // Batch operation permission check
  canPerformBatchOperation(resource: string, action: string, count: number): boolean {
    if (!this.canPerformOperation(resource, action)) {
      return false
    }

    // Check if user has batch operation permission
    const batchPermission = `${resource}:batch_${action}`
    return this.has(batchPermission)
  }

  require(permission: string): void {
    if (!this.has(permission)) {
      throw new UnauthorizedError(`Missing permission: ${permission}`)
    }
  }

  requireAll(permissions: string[]): void {
    const missing = permissions.filter(p => !this.has(p))
    if (missing.length > 0) {
      throw new UnauthorizedError(`Missing permissions: ${missing.join(', ')}`)
    }
  }

  requireRoute(config: RoutePermissionConfig): void {
    if (!this.canAccessRoute(config)) {
      throw new UnauthorizedError(`Access denied to route: ${config.path}`)
    }
  }

  requireOperation(resource: string, action: string): void {
    if (!this.canPerformOperation(resource, action)) {
      throw new UnauthorizedError(`Cannot perform ${action} on ${resource}`)
    }
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnauthorizedError'
  }
}
