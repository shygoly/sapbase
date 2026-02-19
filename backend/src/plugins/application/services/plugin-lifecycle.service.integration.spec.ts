import { Test, TestingModule } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { PluginLifecycleService } from './plugin-lifecycle.service'
import { PluginRepository } from '../../infrastructure/persistence/plugin.repository'
import { PluginLoaderService } from '../../infrastructure/services/plugin-loader.service'
import { DependencyResolverService } from '../../infrastructure/services/dependency-resolver.service'
import { PluginRuntimeService } from '../../infrastructure/runtime/plugin-runtime.service'
import { PluginContextProvider } from '../../infrastructure/runtime/plugin-context-provider.service'
import { PluginEventEmitterService } from '../../infrastructure/events/plugin-event-emitter.service'
import { PluginSecurityValidatorService } from '../../infrastructure/security/plugin-security-validator.service'
import { PluginDatabaseAccessService } from '../../infrastructure/database/plugin-database-access.service'
import { PluginModuleIntegrationService } from './plugin-module-integration.service'
import {
  PLUGIN_REPOSITORY,
  PLUGIN_LOADER,
  DEPENDENCY_RESOLVER,
  PERMISSION_CHECKER,
  PLUGIN_EVENT_EMITTER,
} from '../../domain/services'
import { PermissionCheckerService } from '../../infrastructure/services/permission-checker.service'
import { Plugin as PluginOrm } from '../../infrastructure/persistence/plugin.entity'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as AdmZip from 'adm-zip'

describe('PluginLifecycleService (Integration)', () => {
  let service: PluginLifecycleService
  let module: TestingModule
  let testZipPath: string
  let testPluginsDir: string
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
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [PluginOrm],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([PluginOrm]),
      ],
      providers: [
        PluginLifecycleService,
        {
          provide: PLUGIN_REPOSITORY,
          useClass: PluginRepository,
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
        {
          provide: PLUGIN_EVENT_EMITTER,
          useClass: PluginEventEmitterService,
        },
        PluginRepository,
        PluginLoaderService,
        DependencyResolverService,
        PermissionCheckerService,
        PluginRuntimeService,
        PluginContextProvider,
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
      const repository = module.get(PLUGIN_REPOSITORY)
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
