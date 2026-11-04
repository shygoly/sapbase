import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common'
import { PermissionsService } from './permissions.service'
import { Permission } from './permission.entity'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { Auth } from '../common/decorators/auth.decorator'

@Controller('permissions')
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  @Get()
  @Auth()
  async findAll(@OrganizationId() organizationId: string): Promise<Permission[]> {
    return this.permissionsService.findAll(organizationId)
  }

  @Get(':id')
  @Auth()
  async findOne(@Param('id') id: string, @OrganizationId() organizationId: string): Promise<Permission> {
    return this.permissionsService.findOne(id, organizationId)
  }

  @Post()
  @Auth('permissions:create')
  async create(
    @Body() body: { name: string; description?: string },
    @OrganizationId() organizationId: string,
  ): Promise<Permission> {
    return this.permissionsService.create(body.name, organizationId, body.description)
  }

  @Put(':id')
  @Auth('permissions:update')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
    @OrganizationId() organizationId: string,
  ): Promise<Permission> {
    return this.permissionsService.update(id, organizationId, body.name, body.description)
  }
}
