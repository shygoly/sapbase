import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import { PLUGIN_REPOSITORY } from '../../domain/repositories'
import type { IPluginRepository } from '../../domain/repositories'
import { PluginPermissions } from '../../domain/entities/plugin-permission.entity'

@Injectable()
export class GetPluginsService {
  constructor(
    @Inject(PLUGIN_REPOSITORY)
    private readonly pluginRepository: IPluginRepository,
  ) {}

  async findAll(organizationId: string) {
    const plugins = await this.pluginRepository.findAll(organizationId)
    return plugins.map((plugin) => this.toDto(plugin))
  }

  async findOne(id: string, organizationId: string) {
    const plugin = await this.pluginRepository.findById(id, organizationId)
    if (!plugin) {
      throw new NotFoundException(`Plugin with ID ${id} not found`)
    }
    return this.toDto(plugin)
  }

  private toDto(plugin: any) {
    const permissions = PluginPermissions.fromManifest(
      plugin.manifest.permissions || {},
    )
    return {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      type: plugin.type,
      description: plugin.manifest.description,
      author: plugin.manifest.author,
      license: plugin.manifest.license,
      status: plugin.status,
      permissions: {
        api: permissions.api
          ? {
              endpoints: permissions.api.endpoints,
              methods: permissions.api.methods,
            }
          : undefined,
        database: permissions.database
          ? {
              tables: permissions.database.tables,
              operations: permissions.database.operations,
            }
          : undefined,
        ui: permissions.ui
          ? {
              components: permissions.ui.components,
              pages: permissions.ui.pages,
            }
          : undefined,
        modules: permissions.modules
          ? {
              extend: permissions.modules.extend,
              create: permissions.modules.create,
            }
          : undefined,
      },
      dependencies: plugin.manifest.dependencies,
      createdAt: plugin.createdAt,
      updatedAt: plugin.updatedAt,
    }
  }
}
