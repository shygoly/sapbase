import { PluginSecurityValidatorService } from './plugin-security-validator.service'
import * as fs from 'fs/promises'
import * as AdmZip from 'adm-zip'
import { PluginType, type PluginManifest } from '../../domain/entities/plugin.entity'

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
    it('should NOT block eval() in code（文本扫描只是信号）', async () => {
      const manifest: PluginManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        type: PluginType.INTEGRATION,
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

      // 文本命中 → 只写信号（install 不再被它拦下）；真正的边界是子进程的 --permission
      expect(result.isValid).toBe(true)
      expect(result.signals.some((signal) => signal.includes('eval'))).toBe(true)
    })

    it('should NOT block Function constructor（文本扫描只是信号）', async () => {
      const manifest: PluginManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        type: PluginType.INTEGRATION,
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

      expect(result.isValid).toBe(true)
      expect(result.signals.some((signal) => signal.includes('Function constructor'))).toBe(true)
    })

    it('should NOT block child_process require（文本扫描只是信号）', async () => {
      const manifest: PluginManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        type: PluginType.INTEGRATION,
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

      expect(result.isValid).toBe(true)
      expect(result.signals.some((signal) => signal.includes('child_process'))).toBe(true)
    })

    it('should reject plugin exceeding size limit', async () => {
      const manifest: PluginManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        type: PluginType.INTEGRATION,
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
        type: PluginType.INTEGRATION,
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
        type: PluginType.INTEGRATION,
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

  it('scan 可以被绕过（这正是不让它当判决的理由）', async () => {
    // 同样的意图，换成字符串拼接 —— 正则匹配不到
    const manifest: PluginManifest = {
      name: 'test-plugin',
      version: '1.0.0',
      type: PluginType.INTEGRATION,
      permissions: {},
      entry: { backend: 'index.js' },
    }
    const mockZip = {
      getEntries: jest.fn().mockReturnValue([
        {
          isDirectory: false,
          entryName: 'index.js',
          header: { size: 100 },
          getData: () => Buffer.from("require('child_' + 'process')"),
        },
      ]),
    }
    ;(AdmZip as any).mockImplementation(() => mockZip)

    const result = await service.validatePluginPackage('test.zip', manifest)

    expect(result.isValid).toBe(true)
    expect(result.signals).toEqual([]) // 扫描完全没看见它
    // 它仍然越不了权：子进程边界会拒（见 plugin-host-process.spec.ts 的三条实测）
  })
})
