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
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { ModuleRegistryService, CreateModuleRegistryDto, CreateCapabilityDto, CreateRelationshipDto } from './module-registry.service'
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

  @Delete(':id/relationships/:relId')
  @ApiOperation({ summary: 'Remove module relationship' })
  async removeRelationship(
    @Param('id') id: string,
    @Param('relId') relId: string,
    @OrganizationId() organizationId: string,
  ) {
    // Verify module belongs to organization
    await this.moduleRegistryService.findOne(id, organizationId)
    await this.moduleRegistryService.removeRelationship(id, relId)
    return { message: 'Relationship removed successfully' }
  }

  @Get(':id/statistics')
  @ApiOperation({ summary: 'Get module statistics' })
  async getStatistics(@Param('id') id: string) {
    return this.moduleRegistryService.getStatistics(id)
  }

  @Put(':id/statistics/:entity')
  @ApiOperation({ summary: 'Update module statistics' })
  async updateStatistics(
    @Param('id') id: string,
    @Param('entity') entity: string,
    @Body() stats: Partial<any>,
  ) {
    return this.moduleRegistryService.updateStatistics(id, entity, stats)
  }

  @Get(':id/configurations')
  @ApiOperation({ summary: 'Get module configurations' })
  async getConfigurations(@Param('id') id: string) {
    return this.moduleRegistryService.getConfigurations(id)
  }

  @Post(':id/configurations')
  @ApiOperation({ summary: 'Add module configuration' })
  async addConfiguration(
    @Param('id') id: string,
    @Body() body: { configType: string; schema?: any; documentation?: string },
  ) {
    return this.moduleRegistryService.addConfiguration(
      id,
      body.configType,
      body.schema,
      body.documentation,
    )
  }
}
