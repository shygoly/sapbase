import { PermissionCheckerService } from './permission-checker.service'
import { PluginPermissions } from '../../domain/entities/plugin-permission.entity'

describe('PermissionCheckerService', () => {
  let service: PermissionCheckerService

  beforeEach(() => {
    service = new PermissionCheckerService()
  })

  describe('checkApiPermission', () => {
    it('should allow access to declared endpoint', () => {
      const permissions = PluginPermissions.fromManifest({
        api: {
          endpoints: ['/api/users'],
          methods: ['GET', 'POST'],
        },
      })

      const result = service.checkApiPermission(permissions, '/api/users', 'GET')

      expect(result).toBe(true)
    })

    it('should deny access to undeclared endpoint', () => {
      const permissions = PluginPermissions.fromManifest({
        api: {
          endpoints: ['/api/users'],
          methods: ['GET'],
        },
      })

      const result = service.checkApiPermission(
        permissions,
        '/api/other',
        'GET',
      )

      expect(result).toBe(false)
    })

    it('should deny access to undeclared method', () => {
      const permissions = PluginPermissions.fromManifest({
        api: {
          endpoints: ['/api/users'],
          methods: ['GET'],
        },
      })

      const result = service.checkApiPermission(
        permissions,
        '/api/users',
        'POST',
      )

      expect(result).toBe(false)
    })
  })

  describe('checkDatabasePermission', () => {
    it('should allow read access to declared table', () => {
      const permissions = PluginPermissions.fromManifest({
        database: {
          tables: ['users'],
          operations: ['read'],
        },
      })

      const result = service.checkDatabasePermission(
        permissions,
        'users',
        'read',
      )

      expect(result).toBe(true)
    })

    it('should deny access to undeclared table', () => {
      const permissions = PluginPermissions.fromManifest({
        database: {
          tables: ['users'],
          operations: ['read'],
        },
      })

      const result = service.checkDatabasePermission(
        permissions,
        'orders',
        'read',
      )

      expect(result).toBe(false)
    })

    it('should deny undeclared operation', () => {
      const permissions = PluginPermissions.fromManifest({
        database: {
          tables: ['users'],
          operations: ['read'],
        },
      })

      const result = service.checkDatabasePermission(
        permissions,
        'users',
        'write',
      )

      expect(result).toBe(false)
    })
  })

  describe('checkModulePermission', () => {
    it('should allow extending declared module', () => {
      const permissions = PluginPermissions.fromManifest({
        modules: {
          extend: ['existing-module'],
        },
      })

      const result = service.checkModulePermission(
        permissions,
        'existing-module',
      )

      expect(result).toBe(true)
    })

    it('should deny extending undeclared module', () => {
      const permissions = PluginPermissions.fromManifest({
        modules: {
          extend: ['existing-module'],
        },
      })

      const result = service.checkModulePermission(permissions, 'other-module')

      expect(result).toBe(false)
    })

    it('should allow module creation when permitted', () => {
      const permissions = PluginPermissions.fromManifest({
        modules: {
          create: true,
        },
      })

      const result = service.checkModuleCreationPermission(permissions)

      expect(result).toBe(true)
    })

    it('should deny module creation when not permitted', () => {
      const permissions = PluginPermissions.fromManifest({
        modules: {
          create: false,
        },
      })

      const result = service.checkModuleCreationPermission(permissions)

      expect(result).toBe(false)
    })
  })
})
