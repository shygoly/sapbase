import type { User } from './types'

export interface PermissionContext {
  user: User | null
  organizationId?: string
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
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnauthorizedError'
  }
}
