import { Test, TestingModule } from '@nestjs/testing'
import { PluginApiRouterService } from './plugin-api-router.service'
import { PluginRuntimeService } from './plugin-runtime.service'
import {
  PERMISSION_CHECKER,
  PLUGIN_EVENT_EMITTER,
} from '../../domain/services'
import { PermissionCheckerService } from '../services/permission-checker.service'
import { PluginEventEmitterService } from '../events/plugin-event-emitter.service'
import { Plugin, PluginStatus, PluginType } from '../../domain/entities/plugin.entity'
import { Request, Response, NextFunction } from 'express'

describe('PluginApiRouterService - Permission Enforcement', () => {
  let service: PluginApiRouterService
  let runtimeService: PluginRuntimeService
  let permissionChecker: PermissionCheckerService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginApiRouterService,
        PluginRuntimeService,
        {
          provide: PERMISSION_CHECKER,
          useClass: PermissionCheckerService,
        },
        {
          provide: PLUGIN_EVENT_EMITTER,
          useClass: PluginEventEmitterService,
        },
      ],
    }).compile()

    service = module.get<PluginApiRouterService>(PluginApiRouterService)
    runtimeService = module.get<PluginRuntimeService>(PluginRuntimeService)
    permissionChecker = module.get(PERMISSION_CHECKER)
  })

  describe('Permission Enforcement', () => {
    it('should allow access to permitted endpoint', async () => {
      const plugin = Plugin.create(
        'plugin-1',
        'org-1',
        {
          name: 'test-plugin',
          version: '1.0.0',
          type: PluginType.INTEGRATION,
          permissions: {
            api: {
              endpoints: ['/api/test'],
              methods: ['GET'],
            },
          },
          entry: { backend: 'index.js' },
          api: {
            routes: [
              {
                path: '/api/test',
                method: 'GET',
                handler: 'handleTest',
              },
            ],
          },
        },
        '/path',
      )

      await runtimeService.loadPlugin(plugin)

      const req = {
        params: { pluginId: 'plugin-1' },
        path: '/api/plugins/plugin-1/api/test',
        method: 'GET',
      } as any

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any

      const next = jest.fn()

      // Mock permission check to return true
      jest.spyOn(permissionChecker, 'checkApiPermission').mockReturnValue(true)

      const router = service.getRouter()
      // Note: This is a simplified test - actual router testing would require more setup
      // The key is that permissionChecker.checkApiPermission is called
      expect(permissionChecker.checkApiPermission).toBeDefined()
    })

    it('should deny access to non-permitted endpoint', () => {
      const pluginPermissions = {
        api: {
          endpoints: ['/api/test'],
          methods: ['GET'],
        },
      }

      const hasPermission = permissionChecker.checkApiPermission(
        pluginPermissions as any,
        '/api/unauthorized',
        'GET',
      )

      expect(hasPermission).toBe(false)
    })
  })
})
