import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { ModuleRegistryService } from './module-registry.service'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'

@ApiTags('AI Context')
@Controller('ai/modules')
export class AIContextController {
  constructor(private readonly moduleRegistryService: ModuleRegistryService) {}

  @Get()
  @ApiOperation({ summary: 'List all modules for AI context' })
  async listModules(@OrganizationId() organizationId?: string) {
    if (!organizationId) {
      return []
    }
    const modules = await this.moduleRegistryService.findAll(organizationId)
    // Return simplified format for AI
    return modules.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      moduleType: m.moduleType,
      status: m.status,
      version: m.version,
      entities: m.metadata?.entities || [],
    }))
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get module context for AI' })
  async getModuleContext(
    @Param('id') id: string,
    @OrganizationId() organizationId?: string,
  ) {
    if (!organizationId) {
      throw new Error('Organization ID is required')
    }
    const module = await this.moduleRegistryService.findOne(id, organizationId)
    const capabilities = await this.moduleRegistryService.getCapabilities(id)
    const relationships = await this.moduleRegistryService.getRelationships(id)
    const statistics = await this.moduleRegistryService.getStatistics(id)

    return {
      id: module.id,
      name: module.name,
      description: module.description,
      moduleType: module.moduleType,
      status: module.status,
      version: module.version,
      metadata: module.metadata,
      capabilities: capabilities.map((c) => ({
        type: c.capabilityType,
        entity: c.entity,
        operations: c.operations,
        apiEndpoints: c.apiEndpoints,
        description: c.description,
      })),
      relationships: relationships.map((r) => ({
        type: r.relationshipType,
        targetModuleId: r.targetModuleId,
        sourceModuleId: r.sourceModuleId,
        description: r.description,
      })),
      statistics: statistics.map((s) => ({
        entity: s.entity,
        recordCount: s.recordCount,
        lastUpdate: s.lastUpdate,
        healthStatus: s.healthStatus,
      })),
    }
  }

  @Get(':id/capabilities')
  @ApiOperation({ summary: 'Get module capabilities for AI' })
  async getCapabilities(@Param('id') id: string) {
    const capabilities = await this.moduleRegistryService.getCapabilities(id)
    return capabilities.map((c) => ({
      type: c.capabilityType,
      entity: c.entity,
      operations: c.operations,
      apiEndpoints: c.apiEndpoints,
      description: c.description,
    }))
  }

  @Get(':id/relationships')
  @ApiOperation({ summary: 'Get module relationships for AI' })
  async getRelationships(@Param('id') id: string) {
    const relationships = await this.moduleRegistryService.getRelationships(id)
    return relationships.map((r) => ({
      type: r.relationshipType,
      targetModuleId: r.targetModuleId,
      sourceModuleId: r.sourceModuleId,
      description: r.description,
      configuration: r.configuration,
    }))
  }

  @Get(':id/statistics')
  @ApiOperation({ summary: 'Get module statistics for AI' })
  async getStatistics(@Param('id') id: string) {
    const statistics = await this.moduleRegistryService.getStatistics(id)
    return statistics.map((s) => ({
      entity: s.entity,
      recordCount: s.recordCount,
      lastUpdate: s.lastUpdate,
      errorCount: s.errorCount,
      averageResponseTime: s.averageResponseTime,
      healthStatus: s.healthStatus,
      collectedAt: s.collectedAt,
    }))
  }
}
