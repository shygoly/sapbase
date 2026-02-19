import { Injectable, Inject } from '@nestjs/common'
import { PLUGIN_REPOSITORY } from '../../domain/repositories'
import { MODULE_REGISTRY_SERVICE } from '../../../ai-module-context/domain/services'
import type { IPluginRepository } from '../../domain/repositories'
import type { IModuleRegistryService } from '../../../ai-module-context/domain/services'
import { PluginPermissions } from '../../domain/entities/plugin-permission.entity'

export interface RegisterModuleFromPluginCommand {
  pluginId: string
  organizationId: string
  moduleName: string
  moduleDescription: string
  moduleType?: string
}

@Injectable()
export class PluginModuleIntegrationService {
  constructor(
    @Inject(PLUGIN_REPOSITORY)
    private readonly pluginRepository: IPluginRepository,
    @Inject(MODULE_REGISTRY_SERVICE)
    private readonly moduleRegistryService: IModuleRegistryService,
  ) {}

  async registerModuleFromPlugin(
    command: RegisterModuleFromPluginCommand,
  ): Promise<string> {
    const plugin = await this.pluginRepository.findById(
      command.pluginId,
      command.organizationId,
    )

    if (!plugin) {
      throw new Error('Plugin not found')
    }

    // Check module creation permission
    const permissions = PluginPermissions.fromManifest(
      plugin.manifest.permissions || {},
    )

    if (!permissions.canCreateModule()) {
      throw new Error('Plugin does not have permission to create modules')
    }

    // Register module in module registry
    // Note: This creates a placeholder module - actual implementation would
    // depend on plugin's module definition
    const moduleId = await this.moduleRegistryService.registerModule(
      `plugin-${plugin.id}-${Date.now()}`, // Generate unique module ID
      {
        name: command.moduleName,
        description: command.moduleDescription,
        version: plugin.version,
        patchContent: {
          pluginId: plugin.id,
          pluginName: plugin.name,
          type: command.moduleType || 'integration',
        },
        organizationId: command.organizationId,
      },
    )

    return moduleId
  }

  async extendModuleFromPlugin(
    pluginId: string,
    organizationId: string,
    moduleName: string,
    extensions: Record<string, any>,
  ): Promise<void> {
    const plugin = await this.pluginRepository.findById(
      pluginId,
      organizationId,
    )

    if (!plugin) {
      throw new Error('Plugin not found')
    }

    // Check module extension permission
    const permissions = PluginPermissions.fromManifest(
      plugin.manifest.permissions || {},
    )

    if (!permissions.canExtendModule(moduleName)) {
      throw new Error(
        `Plugin does not have permission to extend module ${moduleName}`,
      )
    }

    // TODO: Implement module extension logic
    // This would add capabilities or modify existing module behavior
  }
}
