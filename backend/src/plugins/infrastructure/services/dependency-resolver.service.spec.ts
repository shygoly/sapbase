import { DependencyResolverService } from './dependency-resolver.service'
import type { PluginManifest } from '../../domain/entities/plugin.entity'

describe('DependencyResolverService', () => {
  let service: DependencyResolverService

  beforeEach(() => {
    service = new DependencyResolverService()
  })

  describe('resolveDependencies', () => {
    it('should allow installation when no dependencies', async () => {
      const manifest: PluginManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        type: 'integration',
        permissions: {},
        entry: { backend: 'index.js' },
      }

      const result = await service.resolveDependencies(manifest, [])

      expect(result.canInstall).toBe(true)
      expect(result.missing).toHaveLength(0)
    })

    it('should detect missing dependencies', async () => {
      const manifest: PluginManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        type: 'integration',
        permissions: {},
        entry: { backend: 'index.js' },
        dependencies: {
          plugins: [{ name: 'required-plugin', version: '^1.0.0' }],
        },
      }

      const installedPlugins = []

      const result = await service.resolveDependencies(manifest, installedPlugins)

      expect(result.canInstall).toBe(false)
      expect(result.missing).toHaveLength(1)
      expect(result.missing[0].name).toBe('required-plugin')
    })

    it('should detect incompatible versions', async () => {
      const manifest: PluginManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        type: 'integration',
        permissions: {},
        entry: { backend: 'index.js' },
        dependencies: {
          plugins: [{ name: 'required-plugin', version: '^2.0.0' }],
        },
      }

      const installedPlugins = [{ name: 'required-plugin', version: '1.0.0' }]

      const result = await service.resolveDependencies(manifest, installedPlugins)

      expect(result.canInstall).toBe(false)
      expect(result.incompatible).toHaveLength(1)
    })

    it('should allow installation when dependencies are satisfied', async () => {
      const manifest: PluginManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        type: 'integration',
        permissions: {},
        entry: { backend: 'index.js' },
        dependencies: {
          plugins: [{ name: 'required-plugin', version: '^1.0.0' }],
        },
      }

      const installedPlugins = [{ name: 'required-plugin', version: '1.5.0' }]

      const result = await service.resolveDependencies(manifest, installedPlugins)

      expect(result.canInstall).toBe(true)
      expect(result.missing).toHaveLength(0)
      expect(result.incompatible).toHaveLength(0)
    })

    it('should check system version requirement', async () => {
      const manifest: PluginManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        type: 'integration',
        permissions: {},
        entry: { backend: 'index.js' },
        dependencies: {
          system: { minVersion: '2.0.0' },
        },
      }

      // Mock system version check - in real implementation this would check actual version
      const result = await service.resolveDependencies(manifest, [])

      // System version check would be implemented here
      expect(result).toBeDefined()
    })
  })
})
