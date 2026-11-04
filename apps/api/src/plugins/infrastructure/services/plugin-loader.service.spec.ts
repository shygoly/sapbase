import { PluginLoaderService } from './plugin-loader.service'
import { BadRequestException } from '@nestjs/common'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as AdmZip from 'adm-zip'

jest.mock('fs/promises')
jest.mock('adm-zip')

describe('PluginLoaderService', () => {
  let service: PluginLoaderService
  const mockZipPath = '/tmp/test-plugin.zip'
  const mockExtractPath = '/tmp/extracted'

  beforeEach(() => {
    service = new PluginLoaderService()
    jest.clearAllMocks()
  })

  describe('loadManifest', () => {
    it('should load and validate valid manifest', async () => {
      const validManifest = {
        name: 'test-plugin',
        version: '1.0.0',
        type: 'integration',
        permissions: {},
        entry: { backend: 'index.js' },
      }

      const mockZip = {
        getEntry: jest.fn().mockReturnValue({
          getData: jest.fn().mockReturnValue(
            Buffer.from(JSON.stringify(validManifest)),
          ),
        }),
      }

      ;(AdmZip as any).mockImplementation(() => mockZip)

      const manifest = await service.loadManifest(mockZipPath)

      expect(manifest.name).toBe('test-plugin')
      expect(manifest.version).toBe('1.0.0')
    })

    it('should throw error for invalid manifest', async () => {
      const invalidManifest = { name: 'test' } // Missing required fields

      const mockZip = {
        getEntry: jest.fn().mockReturnValue({
          getData: jest.fn().mockReturnValue(
            Buffer.from(JSON.stringify(invalidManifest)),
          ),
        }),
      }

      ;(AdmZip as any).mockImplementation(() => mockZip)

      await expect(service.loadManifest(mockZipPath)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('should throw error if manifest.json not found', async () => {
      const mockZip = {
        getEntry: jest.fn().mockReturnValue(null),
      }

      ;(AdmZip as any).mockImplementation(() => mockZip)

      await expect(service.loadManifest(mockZipPath)).rejects.toThrow(
        BadRequestException,
      )
    })
  })

  describe('extractPlugin', () => {
    it('should extract plugin files', async () => {
      const mockZip = {
        extractAllTo: jest.fn(),
      }

      ;(AdmZip as any).mockImplementation(() => mockZip)

      await service.extractPlugin(mockZipPath, mockExtractPath)

      expect(mockZip.extractAllTo).toHaveBeenCalledWith(mockExtractPath, true)
    })
  })

  describe('loadPluginCode', () => {
    it('should verify entry point exists', async () => {
      const entryPath = path.join(mockExtractPath, 'index.js')
      ;(fs.access as jest.Mock).mockResolvedValue(undefined)

      await service.loadPluginCode(mockExtractPath, 'index.js')

      expect(fs.access).toHaveBeenCalledWith(entryPath)
    })

    it('should throw error if entry point not found', async () => {
      ;(fs.access as jest.Mock).mockRejectedValue(new Error('Not found'))

      await expect(
        service.loadPluginCode(mockExtractPath, 'index.js'),
      ).rejects.toThrow(BadRequestException)
    })
  })
})
