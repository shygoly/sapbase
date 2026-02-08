import { PermissionGuard } from '@/core/auth/permission-guard'
import type { User, Permission } from '@/core/auth/types'

describe('PermissionGuard', () => {
  let guard: PermissionGuard
  let mockUser: User

  beforeEach(() => {
    mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
      dataScope: 'organization',
      organizationId: 'org-1',
      departmentId: 'dept-1',
      permissions: ['users.view', 'users.create', 'users.edit', 'departments.view'],
    }

    guard = new PermissionGuard()
  })

  describe('has', () => {
    it('should return true when user has permission', () => {
      const result = guard.has(mockUser, 'users.view')
      expect(result).toBe(true)
    })

    it('should return false when user lacks permission', () => {
      const result = guard.has(mockUser, 'users.delete')
      expect(result).toBe(false)
    })

    it('should return false when user is null', () => {
      const result = guard.has(null, 'users.view')
      expect(result).toBe(false)
    })

    it('should return true for super_admin regardless of permissions', () => {
      const superAdmin = { ...mockUser, role: 'super_admin' }
      const result = guard.has(superAdmin, 'any.permission')
      expect(result).toBe(true)
    })
  })

  describe('hasAll', () => {
    it('should return true when user has all permissions', () => {
      const result = guard.hasAll(mockUser, ['users.view', 'users.create'])
      expect(result).toBe(true)
    })

    it('should return false when user lacks any permission', () => {
      const result = guard.hasAll(mockUser, ['users.view', 'users.delete'])
      expect(result).toBe(false)
    })

    it('should return true for empty permissions array', () => {
      const result = guard.hasAll(mockUser, [])
      expect(result).toBe(true)
    })
  })

  describe('hasAny', () => {
    it('should return true when user has at least one permission', () => {
      const result = guard.hasAny(mockUser, ['users.view', 'users.delete'])
      expect(result).toBe(true)
    })

    it('should return false when user has no permissions', () => {
      const result = guard.hasAny(mockUser, ['users.delete', 'roles.delete'])
      expect(result).toBe(false)
    })

    it('should return false for empty permissions array', () => {
      const result = guard.hasAny(mockUser, [])
      expect(result).toBe(false)
    })
  })

  describe('canAccessResource', () => {
    it('should allow super_admin to access all resources', () => {
      const superAdmin = { ...mockUser, role: 'super_admin' }
      const result = guard.canAccessResource(superAdmin, {
        organizationId: 'other-org',
        departmentId: 'other-dept',
        ownerId: 'other-user',
      })
      expect(result).toBe(true)
    })

    it('should deny access to different organization', () => {
      const result = guard.canAccessResource(mockUser, {
        organizationId: 'other-org',
      })
      expect(result).toBe(false)
    })

    it('should enforce department scope correctly', () => {
      const deptScopedUser = { ...mockUser, dataScope: 'department' }
      const result = guard.canAccessResource(deptScopedUser, {
        organizationId: 'org-1',
        departmentId: 'other-dept',
      })
      expect(result).toBe(false)
    })

    it('should enforce self scope correctly', () => {
      const selfScopedUser = { ...mockUser, dataScope: 'self' }
      const result = guard.canAccessResource(selfScopedUser, {
        organizationId: 'org-1',
        ownerId: 'other-user',
      })
      expect(result).toBe(false)
    })

    it('should return false when user is null', () => {
      const result = guard.canAccessResource(null, {
        organizationId: 'org-1',
      })
      expect(result).toBe(false)
    })

    it('should allow access to own resource with self scope', () => {
      const selfScopedUser = { ...mockUser, dataScope: 'self', id: 'user-1' }
      const result = guard.canAccessResource(selfScopedUser, {
        organizationId: 'org-1',
        ownerId: 'user-1',
      })
      expect(result).toBe(true)
    })
  })

  describe('require', () => {
    it('should not throw when user has permission', () => {
      expect(() => {
        guard.require(mockUser, 'users.view')
      }).not.toThrow()
    })

    it('should throw UnauthorizedError when user lacks permission', () => {
      expect(() => {
        guard.require(mockUser, 'users.delete')
      }).toThrow('Unauthorized')
    })

    it('should throw when user is null', () => {
      expect(() => {
        guard.require(null, 'users.view')
      }).toThrow('Unauthorized')
    })
  })

  describe('requireAll', () => {
    it('should not throw when user has all permissions', () => {
      expect(() => {
        guard.requireAll(mockUser, ['users.view', 'users.create'])
      }).not.toThrow()
    })

    it('should throw with missing permissions', () => {
      expect(() => {
        guard.requireAll(mockUser, ['users.view', 'users.delete'])
      }).toThrow('Unauthorized')
    })
  })

  describe('requireAny', () => {
    it('should not throw when user has at least one permission', () => {
      expect(() => {
        guard.requireAny(mockUser, ['users.view', 'users.delete'])
      }).not.toThrow()
    })

    it('should throw when user has no permissions', () => {
      expect(() => {
        guard.requireAny(mockUser, ['users.delete', 'roles.delete'])
      }).toThrow('Unauthorized')
    })
  })

  describe('requireAccess', () => {
    it('should not throw when user can access resource', () => {
      expect(() => {
        guard.requireAccess(mockUser, {
          organizationId: 'org-1',
          departmentId: 'dept-1',
        })
      }).not.toThrow()
    })

    it('should throw when user cannot access resource', () => {
      expect(() => {
        guard.requireAccess(mockUser, {
          organizationId: 'other-org',
        })
      }).toThrow('Unauthorized')
    })
  })
})
