import { Injectable, BadRequestException } from '@nestjs/common'
import * as fs from 'fs/promises'
import * as path from 'path'
import AdmZip from 'adm-zip'
import { Validator } from 'jsonschema'
import { PluginManifest, PluginType } from '../../domain/entities/plugin.entity'
import type { IPluginLoader } from '../../domain/services'

const MANIFEST_SCHEMA = {
  type: 'object',
  required: ['name', 'version', 'type', 'permissions', 'entry'],
  properties: {
    name: { type: 'string', minLength: 1 },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+(-.*)?$' },
    type: { enum: ['integration', 'ui', 'theme'] },
    description: { type: 'string' },
    author: { type: 'string' },
    license: { type: 'string' },
    permissions: {
      type: 'object',
      properties: {
        api: {
          type: 'object',
          properties: {
            endpoints: { type: 'array', items: { type: 'string' } },
            methods: {
              type: 'array',
              items: { enum: ['GET', 'POST', 'PUT', 'DELETE'] },
            },
          },
        },
        database: {
          type: 'object',
          properties: {
            tables: { type: 'array', items: { type: 'string' } },
            operations: {
              type: 'array',
              items: { enum: ['read', 'write', 'delete'] },
            },
          },
        },
        ui: {
          type: 'object',
          properties: {
            components: { type: 'array', items: { type: 'string' } },
            pages: { type: 'array', items: { type: 'string' } },
          },
        },
        modules: {
          type: 'object',
          properties: {
            extend: { type: 'array', items: { type: 'string' } },
            create: { type: 'boolean' },
          },
        },
      },
    },
    dependencies: {
      type: 'object',
      properties: {
        plugins: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'version'],
            properties: {
              name: { type: 'string' },
              version: { type: 'string' },
            },
          },
        },
        system: {
          type: 'object',
          properties: {
            minVersion: { type: 'string' },
          },
        },
      },
    },
    entry: {
      type: 'object',
      required: ['backend'],
      properties: {
        backend: { type: 'string' },
        frontend: { type: 'string' },
      },
    },
    hooks: {
      type: 'object',
      properties: {
        onInstall: { type: 'string' },
        onActivate: { type: 'string' },
        onDeactivate: { type: 'string' },
        onUninstall: { type: 'string' },
      },
    },
    api: {
      type: 'object',
      properties: {
        routes: {
          type: 'array',
          items: {
            type: 'object',
            required: ['path', 'method', 'handler'],
            properties: {
              path: { type: 'string' },
              method: { enum: ['GET', 'POST', 'PUT', 'DELETE'] },
              handler: { type: 'string' },
            },
          },
        },
      },
    },
    ui: {
      type: 'object',
      properties: {
        components: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'path', 'type'],
            properties: {
              name: { type: 'string' },
              path: { type: 'string' },
              type: { enum: ['component', 'page', 'widget'] },
            },
          },
        },
        theme: {
          type: 'object',
          properties: {
            variables: { type: 'object' },
            styles: { type: 'string' },
          },
        },
      },
    },
  },
}

@Injectable()
export class PluginLoaderService implements IPluginLoader {
  async loadManifest(zipPath: string): Promise<PluginManifest> {
    const zip = new AdmZip(zipPath)
    const manifestEntry = zip.getEntry('manifest.json')

    if (!manifestEntry) {
      throw new BadRequestException('Plugin package must contain manifest.json')
    }

    const manifestContent = manifestEntry.getData().toString('utf-8')
    let manifest: PluginManifest

    try {
      manifest = JSON.parse(manifestContent)
    } catch (error) {
      throw new BadRequestException('Invalid manifest.json format')
    }

    await this.validateManifest(manifest)
    return manifest
  }

  async extractPlugin(zipPath: string, targetPath: string): Promise<void> {
    try {
      await fs.mkdir(targetPath, { recursive: true })
      const zip = new AdmZip(zipPath)
      zip.extractAllTo(targetPath, true)
    } catch (error) {
      throw new BadRequestException(
        `Failed to extract plugin: ${(error as Error).message}`,
      )
    }
  }

  async validateManifest(manifest: PluginManifest): Promise<void> {
    const validator = new Validator()
    const result = validator.validate(manifest, MANIFEST_SCHEMA)

    if (!result.valid) {
      const errors = result.errors.map((e: { property: string; message: string }) => `${e.property}: ${e.message}`)
      throw new BadRequestException(
        `Invalid manifest: ${errors.join(', ')}`,
      )
    }

    // Validate plugin type
    if (!['integration', 'ui', 'theme'].includes(manifest.type)) {
      throw new BadRequestException(
        `Invalid plugin type: ${manifest.type}. Must be 'integration', 'ui', or 'theme'`,
      )
    }

    // Validate entry point exists (will be checked during extraction)
    if (!manifest.entry?.backend) {
      throw new BadRequestException('Plugin must declare backend entry point')
    }
  }

  async loadPluginCode(pluginPath: string, entryPoint: string): Promise<any> {
    const entryPath = path.join(pluginPath, entryPoint)

    try {
      // Check if file exists
      await fs.access(entryPath)

      // For now, return the path - actual code loading will be handled by runtime
      // In production, this might use require() or dynamic import
      return {
        path: entryPath,
        exists: true,
      }
    } catch (error) {
      throw new BadRequestException(
        `Plugin entry point not found: ${entryPoint}`,
      )
    }
  }
}
