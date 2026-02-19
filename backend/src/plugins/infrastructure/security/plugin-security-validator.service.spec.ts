import { PluginSecurityValidatorService } from './plugin-security-validator.service'
import * as fs from 'fs/promises'
import * as AdmZip from 'adm-zip'
import type { PluginManifest } from '../../domain/entities/plugin.entity'

jest.mock('fs/promises')
jest.mock('adm-zip')

describe('PluginSecurityValidatorService - Security Tests', () => {
  let service: PluginSecurityValidatorService
  const mockZipPath = '/tmp/test-plugin.zip'

  beforeEach(() => {
    service = new PluginSecurityValidatorService()
    jest.clearAllMocks()
  })

  describe('Security Validation', () => {
    it('should reject plugin with eval() in code', async () => {
      const manifest: PluginManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        type: 'integration',
        permissions: {},
        entry: { backend: 'index.js' },
      }

      const mockZip = {
        getEntries: jest.fn().mockReturnValue([
          {
            isDirectory: false,
            entryName: 'index.js',
            header: { size: 100 },
            getData: jest.fn().mockReturnValue(
              Buffer.from("eval('malicious code')"),
            ),
          },
        ]),
      }

      ;(fs.stat as jest.Mock).mockResolvedValue({ size: 1024 })
      ;(AdmZip as any).mockImplementation(() => mockZip)

      const result = await service.validatePluginPackage(mockZipPath, manifest)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('eval'))).toBe(true)
    })

    it('should reject plugin with Function constructor', async () => {
      const manifest: PluginManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        type: 'integration',
        permissions: {},
        entry: { backend: 'index.js' },
      }

      const mockZip = {
        getEntries: jest.fn().mockReturnValue([
          {
            isDirectory: false,
            entryName: 'index.js',
            header: { size: 100 },
            getData: jest.fn().mockReturnValue(
              Buffer.from("new Function('return malicious')"),
            ),
          },
        ]),
      }

      ;(fs.stat as jest.Mock).mockResolvedValue({ size: 1024 })
      ;(AdmZip as any).mockImplementation(() => mockZip)

      const result = await service.validatePluginPackage(mockZipPath, manifest)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('Function'))).toBe(true)
    })

    it('should reject plugin with child_process require', async () => {
      const manifest: PluginManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        type: 'integration',
        permissions: {},
        entry: { backend: 'index.js' },
      }

      const mockZip = {
        getEntries: jest.fn().mockReturnValue([
          {
            isDirectory: false,
            entryName: 'index.js',
            header: { size: 100 },
            getData: jest.fn().mockReturnValue(
              Buffer.from("require('child_process')"),
            ),
          },
        ]),
      }

      ;(fs.stat as jest.Mock).mockResolvedValue({ size: 1024 })
      ;(AdmZip as any).mockImplementation(() => mockZip)

      const result = await service.validatePluginPackage(mockZipPath, manifest)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('child_process'))).toBe(
        true,
      )
    })

    it('should reject plugin exceeding size limit', async () => {
      const manifest: PluginManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        type: 'integration',
        permissions: {},
        entry: { backend: 'index.js' },
      }

      const mockZip = {
        getEntries: jest.fn().mockReturnValue([]),
      }

      ;(fs.stat as jest.Mock).mockResolvedValue({ size: 100 * 1024 * 1024 }) // 100MB
      ;(AdmZip as any).mockImplementation(() => mockZip)

      const result = await service.validatePluginPackage(mockZipPath, manifest)

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('size limit'))).toBe(true)
    })

    it('should warn about excessive API permissions', async () => {
      const manifest: PluginManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        type: 'integration',
        permissions: {
          api: {
            endpoints: Array(100).fill('/api/endpoint'),
            methods: ['GET'],
          },
        },
        entry: { backend: 'index.js' },
      }

      const mockZip = {
        getEntries: jest.fn().mockReturnValue([
          {
            isDirectory: false,
            entryName: 'index.js',
            header: { size: 100 },
            getData: jest.fn().mockReturnValue(Buffer.from('// safe code')),
          },
        ]),
      }

      ;(fs.stat as jest.Mock).mockResolvedValue({ size: 1024 })
      ;(AdmZip as any).mockImplementation(() => mockZip)

      const result = await service.validatePluginPackage(mockZipPath, manifest)

      expect(result.warnings.some((w) => w.includes('excessive'))).toBe(true)
    })

    it('should allow valid plugin', async () => {
      const manifest: PluginManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        type: 'integration',
        permissions: {
          api: {
            endpoints: ['/api/test'],
            methods: ['GET'],
          },
        },
        entry: { backend: 'index.js' },
      }

      const mockZip = {
        getEntries: jest.fn().mockReturnValue([
          {
            isDirectory: false,
            entryName: 'index.js',
            header: { size: 100 },
            getData: jest.fn().mockReturnValue(
              Buffer.from('// safe plugin code'),
            ),
          },
        ]),
      }

      ;(fs.stat as jest.Mock).mockResolvedValue({ size: 1024 })
      ;(AdmZip as any).mockImplementation(() => mockZip)

      const result = await service.validatePluginPackage(mockZipPath, manifest)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })
})
