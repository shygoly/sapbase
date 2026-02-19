import { Injectable } from '@nestjs/common'
import { ModuleRegistryService } from '../../../module-registry/module-registry.service'
import { ModuleType, ModuleStatus } from '../../../module-registry/module-registry.entity'
import { CapabilityType } from '../../../module-registry/module-capability.entity'
import type { IModuleRegistryService } from '../../domain/services'

@Injectable()
export class ModuleRegistryServiceAdapter implements IModuleRegistryService {
  constructor(private readonly moduleRegistryService: ModuleRegistryService) {}

  async registerModule(
    moduleId: string,
    module: {
      name: string
      description: string | null
      version: string
      patchContent: Record<string, any>
      organizationId: string
    },
  ): Promise<string> {
    const metadata = this.extractMetadataFromPatch(module.patchContent)
    const capabilities = this.extractCapabilitiesFromPatch(module.patchContent)

    const registeredModule = await this.moduleRegistryService.create(
      {
        name: module.name,
        description: module.description || '',
        moduleType: ModuleType.CRUD,
        version: module.version,
        status: ModuleStatus.ACTIVE,
        aiModuleId: moduleId,
        metadata,
      },
      module.organizationId,
    )

    // Register capabilities
    for (const cap of capabilities) {
      await this.moduleRegistryService.addCapability(registeredModule.id, cap, module.organizationId)
    }

    return registeredModule.id
  }

  async unregisterModule(moduleId: string, organizationId: string): Promise<void> {
    // Find registry module by aiModuleId
    const registryModule = await this.moduleRegistryService.findByAiModuleId(moduleId, organizationId)
    if (registryModule) {
      await this.moduleRegistryService.remove(registryModule.id, organizationId)
    }
  }

  async updateModuleRegistry(
    registryModuleId: string,
    aiModuleId: string,
    organizationId: string,
  ): Promise<void> {
    await this.moduleRegistryService.update(
      registryModuleId,
      { aiModuleId },
      organizationId,
    )
  }

  private extractMetadataFromPatch(patchContent: any): Record<string, any> {
    const metadata: Record<string, any> = {
      entities: [],
    }

    if (patchContent && typeof patchContent === 'object') {
      if (patchContent.objects) {
        metadata.entities = Object.keys(patchContent.objects)
      } else if (patchContent.scope === 'object' && patchContent.target?.identifier) {
        metadata.entities = [patchContent.target.identifier]
      }

      if (patchContent.apiBasePath) {
        metadata.apiBasePath = patchContent.apiBasePath
      }

      if (patchContent.schemaPath) {
        metadata.schemaPath = patchContent.schemaPath
      }
    }

    return metadata
  }

  private extractCapabilitiesFromPatch(patchContent: any): Array<{
    capabilityType: CapabilityType
    entity?: string
    operations: string[]
    apiEndpoints: string[]
    description?: string
  }> {
    const capabilities: Array<{
      capabilityType: CapabilityType
      entity?: string
      operations: string[]
      apiEndpoints: string[]
      description?: string
    }> = []

    if (patchContent && typeof patchContent === 'object') {
      if (patchContent.objects) {
        Object.keys(patchContent.objects).forEach((entityName) => {
          capabilities.push({
            capabilityType: CapabilityType.CRUD,
            entity: entityName,
            operations: ['create', 'read', 'update', 'delete'],
            apiEndpoints: [`/api/${entityName.toLowerCase()}`],
            description: `Entity: ${entityName}`,
          })
        })
      }
    }

    return capabilities
  }
}
