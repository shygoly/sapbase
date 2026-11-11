import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import {
  ModuleRegistryService,
  CreateModuleRegistryDto,
  CreateCapabilityDto,
  CreateRelationshipDto,
  UpdateRelationshipDto,
  UpdateConfigurationDto,
} from './module-registry.service'
import { ModuleStatus } from './module-registry.entity'
import { BlueprintExportError } from './blueprint-export'
import { PackageError } from '../blueprint/packager'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { User } from '../users/user.entity'

@ApiTags('Module Registry')
@Controller('module-registry')
@Auth('system:manage')
export class ModuleRegistryController {
  constructor(private readonly moduleRegistryService: ModuleRegistryService) {}

  @Get()
  @ApiOperation({ summary: 'List all modules' })
  @ApiResponse({ status: 200, description: 'List of modules' })
  async findAll(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @OrganizationId() organizationId?: string,
  ) {
    if (!organizationId) {
      throw new NotFoundException('Organization ID is required')
    }
    const modules = await this.moduleRegistryService.findAll(organizationId)
    // Simple filtering (can be enhanced)
    let filtered = modules
    if (status) {
      filtered = filtered.filter((m) => m.status === status)
    }
    if (type) {
      filtered = filtered.filter((m) => m.moduleType === type)
    }
    return filtered
  }

  @Get('graph')
  @ApiOperation({ summary: '模块关系图（节点 + 有向边）' })
  async graph(@OrganizationId() organizationId: string) {
    return this.moduleRegistryService.getRelationshipGraph(organizationId)
  }

  @Get('health')
  @ApiOperation({ summary: '组织模块健康总览' })
  async healthOverview(@OrganizationId() organizationId: string) {
    return this.moduleRegistryService.getHealthOverview(organizationId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get module details' })
  @ApiResponse({ status: 200, description: 'Module details' })
  async findOne(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.moduleRegistryService.findOne(id, organizationId)
  }

  @Post()
  @ApiOperation({ summary: 'Register a new module' })
  @ApiResponse({ status: 201, description: 'Module registered' })
  async create(
    @Body() dto: CreateModuleRegistryDto,
    @CurrentUser() user: User,
    @OrganizationId() organizationId: string,
  ) {
    return this.moduleRegistryService.create(
      {
        ...dto,
        createdById: user.id,
      },
      organizationId,
    )
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update module' })
  @ApiResponse({ status: 200, description: 'Module updated' })
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateModuleRegistryDto>,
    @OrganizationId() organizationId: string,
  ) {
    return this.moduleRegistryService.update(id, dto, organizationId)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Unregister module' })
  @ApiResponse({ status: 200, description: 'Module unregistered' })
  async remove(@Param('id') id: string, @OrganizationId() organizationId: string) {
    await this.moduleRegistryService.remove(id, organizationId)
    return { message: 'Module unregistered successfully' }
  }

  @Get(':id/capabilities')
  @ApiOperation({ summary: 'Get module capabilities' })
  async getCapabilities(@Param('id') id: string, @OrganizationId() organizationId: string) {
    // Verify module belongs to organization
    await this.moduleRegistryService.findOne(id, organizationId)
    return this.moduleRegistryService.getCapabilities(id)
  }

  @Post(':id/export-blueprint')
  @ApiOperation({
    summary: '把模块导出为最小蓝图包（骨架 → .erpkg）',
    description: '实体名取自 capability / metadata.entities；原子依赖逐条解析，解析不到即拒',
  })
  async exportBlueprint(
    @Param('id') id: string,
    @Body() body: { dir?: string; out?: string },
    @OrganizationId() organizationId: string,
  ) {
    try {
      return await this.moduleRegistryService.exportBlueprint(id, organizationId, body ?? {})
    } catch (error) {
      // 导出失败的原因必须原样透出（命名/版本/依赖/无实体/打包），否则调用方只能猜
      if (error instanceof BlueprintExportError || error instanceof PackageError) {
        throw new BadRequestException({ message: error.message, reason: error.reason })
      }
      throw error
    }
  }

  @Post(':id/capabilities')
  @ApiOperation({ summary: 'Add module capability' })
  async addCapability(
    @Param('id') id: string,
    @Body() dto: CreateCapabilityDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.moduleRegistryService.addCapability(id, dto, organizationId)
  }

  @Get(':id/relationships')
  @ApiOperation({ summary: 'Get module relationships' })
  async getRelationships(@Param('id') id: string, @OrganizationId() organizationId: string) {
    // Verify module belongs to organization
    await this.moduleRegistryService.findOne(id, organizationId)
    return this.moduleRegistryService.getRelationships(id)
  }

  @Post(':id/relationships')
  @ApiOperation({ summary: 'Add module relationship' })
  async addRelationship(
    @Param('id') id: string,
    @Body() dto: CreateRelationshipDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.moduleRegistryService.addRelationship(id, dto, organizationId)
  }

  @Put(':id/relationships/:relId')
  @ApiOperation({ summary: 'Update module relationship' })
  async updateRelationship(
    @Param('id') id: string,
    @Param('relId') relId: string,
    @Body() dto: UpdateRelationshipDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.moduleRegistryService.updateRelationship(id, relId, dto, organizationId)
  }

  @Delete(':id/relationships/:relId')
  @ApiOperation({ summary: 'Remove module relationship' })
  async removeRelationship(
    @Param('id') id: string,
    @Param('relId') relId: string,
    @OrganizationId() organizationId: string,
  ) {
    // Verify module belongs to organization
    await this.moduleRegistryService.findOne(id, organizationId)
    await this.moduleRegistryService.removeRelationship(id, relId, organizationId)
    return { message: 'Relationship removed successfully' }
  }

  @Get(':id/statistics')
  @ApiOperation({ summary: 'Get module statistics' })
  async getStatistics(@Param('id') id: string, @OrganizationId() organizationId: string) {
    await this.moduleRegistryService.findOne(id, organizationId)
    return this.moduleRegistryService.getStatistics(id)
  }

  @Post(':id/statistics/collect')
  @ApiOperation({ summary: '从真实表收集模块统计' })
  async collectStatistics(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.moduleRegistryService.collectStatistics(id, organizationId)
  }

  @Get(':id/health')
  @ApiOperation({ summary: '单模块健康检查' })
  async health(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.moduleRegistryService.getHealth(id, organizationId)
  }

  @Get(':id/documentation')
  @ApiOperation({ summary: '生成模块 API/关系/配置文档（Markdown）' })
  async documentation(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.moduleRegistryService.generateDocumentation(id, organizationId)
  }

  @Put(':id/status')
  @ApiOperation({ summary: '更新模块状态（active/inactive/deprecated/error）' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: ModuleStatus },
    @OrganizationId() organizationId: string,
  ) {
    return this.moduleRegistryService.setStatus(id, body.status, organizationId)
  }

  @Put(':id/statistics/:entity')
  @ApiOperation({ summary: 'Update module statistics' })
  async updateStatistics(
    @Param('id') id: string,
    @Param('entity') entity: string,
    @Body() stats: Partial<any>,
    @OrganizationId() organizationId: string,
  ) {
    await this.moduleRegistryService.findOne(id, organizationId)
    return this.moduleRegistryService.updateStatistics(id, entity, stats)
  }

  @Get(':id/configurations')
  @ApiOperation({ summary: 'Get module configurations' })
  async getConfigurations(@Param('id') id: string, @OrganizationId() organizationId: string) {
    await this.moduleRegistryService.findOne(id, organizationId)
    return this.moduleRegistryService.getConfigurations(id)
  }

  @Post(':id/configurations')
  @ApiOperation({ summary: 'Add module configuration' })
  async addConfiguration(
    @Param('id') id: string,
    @Body() body: { configType: string; schema?: any; documentation?: string },
    @OrganizationId() organizationId: string,
  ) {
    await this.moduleRegistryService.findOne(id, organizationId)
    return this.moduleRegistryService.addConfiguration(
      id,
      body.configType,
      body.schema,
      body.documentation,
    )
  }

  @Put(':id/configurations/:configId')
  @ApiOperation({ summary: '编辑模块配置文档' })
  async updateConfiguration(
    @Param('id') id: string,
    @Param('configId') configId: string,
    @Body() dto: UpdateConfigurationDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.moduleRegistryService.updateConfiguration(
      id,
      configId,
      dto,
      organizationId,
    )
  }

  @Delete(':id/configurations/:configId')
  @ApiOperation({ summary: '删除模块配置文档' })
  async deleteConfiguration(
    @Param('id') id: string,
    @Param('configId') configId: string,
    @OrganizationId() organizationId: string,
  ) {
    await this.moduleRegistryService.deleteConfiguration(id, configId, organizationId)
    return { message: 'Configuration removed successfully' }
  }
}
