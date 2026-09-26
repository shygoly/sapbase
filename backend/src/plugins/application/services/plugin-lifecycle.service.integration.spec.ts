import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { PluginLifecycleService } from './plugin-lifecycle.service'
import { PluginRepository } from '../../infrastructure/persistence/plugin.repository'
import type { Plugin } from '../../domain/entities/plugin.entity'
import { PluginLoaderService } from '../../infrastructure/services/plugin-loader.service'
import { DependencyResolverService } from '../../infrastructure/services/dependency-resolver.service'
import { PluginRuntimeService } from '../../infrastructure/runtime/plugin-runtime.service'
import { PluginContextProvider } from '../../infrastructure/runtime/plugin-context-provider.service'
import { AuditLogsService } from '../../../audit-logs/audit-logs.service'
import { PluginEventEmitterService } from '../../infrastructure/events/plugin-event-emitter.service'
import { PluginSecurityValidatorService } from '../../infrastructure/security/plugin-security-validator.service'
import { PluginDatabaseAccessService } from '../../infrastructure/database/plugin-database-access.service'
import { PluginModuleIntegrationService } from './plugin-module-integration.service'
import { PLUGIN_REPOSITORY } from '../../domain/repositories'
import { MODULE_REGISTRY_SERVICE } from '../../../ai-module-context/domain/services/tokens'
import {
  PLUGIN_LOADER,
  DEPENDENCY_RESOLVER,
  PERMISSION_CHECKER,
  PLUGIN_EVENT_EMITTER,
} from '../../domain/services'
import { PermissionCheckerService } from '../../infrastructure/services/permission-checker.service'
import * as fs from 'fs/promises'
import * as path from 'path'
import AdmZip from 'adm-zip'


/**
 * 内存仓库替身。
 *
 * 原来这里用 `TypeOrmModule.forRoot({ type: 'sqlite' })`，依赖收敛后仓库不再安装
 * `sqlite3`（原生依赖），于是整个文件在跑之前就炸。本用例验证的是**生命周期编排**
 * （安装 → 激活 → 停用 → 卸载），数据库不是它的对象 —— 换成内存替身，
 * 真实的 loader / runtime / validator / 事件仍然全部参与。
 */
function memoryRepository() {
  const rows = new Map<string, Plugin>()
  const key = (id: string, organizationId: string) => `${organizationId}::${id}`
  return {
    rows,
    findById: async (id: string, organizationId: string) =>
      rows.get(key(id, organizationId)) ?? null,
    findByName: async (name: string, organizationId: string) =>
      [...rows.values()].find(
        (plugin) => plugin.name === name && plugin.organizationId === organizationId,
      ) ?? null,
    findAll: async (organizationId: string) =>
      [...rows.values()].filter((plugin) => plugin.organizationId === organizationId),
    save: async (plugin: Plugin) => {
      rows.set(key(plugin.id, plugin.organizationId), plugin)
    },
    delete: async (id: string, organizationId: string) => {
      rows.delete(key(id, organizationId))
    },
  }
}

describe('PluginLifecycleService (Integration)', () => {
  let service: PluginLifecycleService
  let module: TestingModule
  let testZipPath: string
  let testPluginsDir: string
  let pluginRepository: ReturnType<typeof memoryRepository>
  const testOrgId = 'test-org-1'

  beforeAll(async () => {
    // Create test plugin ZIP
    testPluginsDir = path.join(process.cwd(), 'test-plugins')
    await fs.mkdir(testPluginsDir, { recursive: true })
    testZipPath = path.join(testPluginsDir, 'test-plugin.zip')

    const manifest = {
      name: 'test-plugin',
      version: '1.0.0',
      type: 'integration',
      description: 'Test plugin',
      permissions: {
        api: {
          endpoints: ['/api/test'],
          methods: ['GET'],
        },
      },
      entry: {
        backend: 'index.js',
      },
    }

    const zip = new AdmZip()
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest)))
    zip.addFile('index.js', Buffer.from('module.exports = class TestPlugin {}'))
    zip.writeZip(testZipPath)
  })

  afterAll(async () => {
    // Cleanup
    try {
      await fs.rm(testPluginsDir, { recursive: true, force: true })
    } catch {}
  })

  beforeEach(async () => {
    pluginRepository = memoryRepository()
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        PluginLifecycleService,
        { provide: DataSource, useValue: {} },
        {
          provide: PLUGIN_REPOSITORY,
          useValue: pluginRepository,
        },
        {
          provide: PLUGIN_LOADER,
          useClass: PluginLoaderService,
        },
        {
          provide: DEPENDENCY_RESOLVER,
          useClass: DependencyResolverService,
        },
        {
          provide: PERMISSION_CHECKER,
          useClass: PermissionCheckerService,
        },
        // PluginModuleIntegrationService 需要模块注册表；本 spec 用最小替身
        {
          provide: MODULE_REGISTRY_SERVICE,
          useValue: { create: async () => ({ id: 'stub' }), findOne: async () => null, register: async () => ({ id: 'stub' }) },
        },
        {
          provide: PLUGIN_EVENT_EMITTER,
          useClass: PluginEventEmitterService,
        },
        PluginLoaderService,
        DependencyResolverService,
        PermissionCheckerService,
        PluginRuntimeService,
        PluginContextProvider,
        // 插件能力审计走 audit_logs（本 spec 用替身）
        { provide: AuditLogsService, useValue: { create: jest.fn().mockResolvedValue({}) } },
        PluginEventEmitterService,
        PluginSecurityValidatorService,
        PluginDatabaseAccessService,
        PluginModuleIntegrationService,
      ],
    }).compile()

    service = module.get<PluginLifecycleService>(PluginLifecycleService)
  })

  afterEach(async () => {
    await module.close()
  })

  describe('Plugin Lifecycle', () => {
    it('should install plugin successfully', async () => {
      const result = await service.install({
        zipPath: testZipPath,
        organizationId: testOrgId,
      })

      expect(result).toBeDefined()
      expect(result.name).toBe('test-plugin')
      expect(result.version).toBe('1.0.0')
      expect(result.status).toBe('installed')
    })

    it('should activate installed plugin', async () => {
      const installed = await service.install({
        zipPath: testZipPath,
        organizationId: testOrgId,
      })

      const activated = await service.activate({
        pluginId: installed.id,
        organizationId: testOrgId,
      })

      expect(activated.status).toBe('active')
    })

    it('should deactivate active plugin', async () => {
      const installed = await service.install({
        zipPath: testZipPath,
        organizationId: testOrgId,
      })

      await service.activate({
        pluginId: installed.id,
        organizationId: testOrgId,
      })

      const deactivated = await service.deactivate({
        pluginId: installed.id,
        organizationId: testOrgId,
      })

      expect(deactivated.status).toBe('inactive')
    })

    it('should uninstall plugin', async () => {
      const installed = await service.install({
        zipPath: testZipPath,
        organizationId: testOrgId,
      })

      await service.uninstall({
        pluginId: installed.id,
        organizationId: testOrgId,
      })

      // Verify plugin is removed
      const repository = pluginRepository
      const found = await repository.findById(installed.id, testOrgId)
      expect(found).toBeNull()
    })

    it('should prevent installing duplicate plugin', async () => {
      await service.install({
        zipPath: testZipPath,
        organizationId: testOrgId,
      })

      await expect(
        service.install({
          zipPath: testZipPath,
          organizationId: testOrgId,
        }),
      ).rejects.toThrow()
    })
  })
})
