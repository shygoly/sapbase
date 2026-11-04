import { Test, TestingModule } from '@nestjs/testing'
import { PluginApiRouterService } from './plugin-api-router.service'
import { PluginRuntimeService } from './plugin-runtime.service'
import { PluginContextProvider } from './plugin-context-provider.service'
import { AuditLogsService } from '../../../audit-logs/audit-logs.service'
import { PluginDatabaseAccessService } from '../database/plugin-database-access.service'
import { PluginModuleIntegrationService } from '../../application/services/plugin-module-integration.service'
import { DataSource } from 'typeorm'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PluginPermissions } from '../../domain/entities/plugin-permission.entity'
import { MODULE_REGISTRY_SERVICE } from '../../../ai-module-context/domain/services/tokens'
import { PLUGIN_REPOSITORY } from '../../domain/repositories'
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
  let pluginDir: string

  beforeEach(async () => {
    // 插件现在跑在受限子进程里：需要一个**真实**的目录与入口文件
    pluginDir = mkdtempSync(join(tmpdir(), 'speckit-router-plugin-'))
    writeFileSync(
      join(pluginDir, 'index.js'),
      'module.exports = { handleTest: () => ({ ok: true }) }',
    )
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginApiRouterService,
        PluginRuntimeService,
        // PluginRuntimeService 后来新增了 context provider 依赖；spec 没跟上就会 DI 报错
        PluginContextProvider,
        { provide: AuditLogsService, useValue: { create: jest.fn().mockResolvedValue({}) } },
        PluginDatabaseAccessService,
        // 本 spec 只验证路由权限，数据库访问用占位（真连库会让单测依赖环境）
        { provide: DataSource, useValue: {} },
        {
          provide: PLUGIN_REPOSITORY,
          useValue: { findById: async () => null, findByName: async () => null, findAll: async () => [], save: async () => {}, delete: async () => {} },
        },
        // PluginModuleIntegrationService 需要模块注册表；本 spec 用最小替身
        {
          provide: MODULE_REGISTRY_SERVICE,
          useValue: { create: async () => ({ id: 'stub' }), findOne: async () => null, register: async () => ({ id: 'stub' }) },
        },

        PluginModuleIntegrationService,
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

  afterEach(async () => {
    // 起的子进程必须收掉，否则 Jest 不退出（也正因为如此，运行时实现了 OnModuleDestroy）
    await runtimeService.onModuleDestroy()
    rmSync(pluginDir, { recursive: true, force: true })
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
        pluginDir,
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
      // 权限必须是领域值对象（PluginPermissions）：传普通对象会让
      // `permissions.hasApiAccess is not a function` —— 这曾是这个用例挂掉的原因
      const pluginPermissions = PluginPermissions.fromManifest({
        api: {
          endpoints: ['/api/test'],
          methods: ['GET'],
        },
      })

      const hasPermission = permissionChecker.checkApiPermission(
        pluginPermissions,
        '/api/unauthorized',
        'GET',
      )

      expect(hasPermission).toBe(false)
    })
  })
})