import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common'
import { PermissionsService } from './permissions.service'
import { Permission } from './permission.entity'
import { Auth } from '../common/decorators/auth.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'

@Controller('permissions')
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  @Get()
  async findAll(@OrganizationId() organizationId: string): Promise<Permission[]> {
    return this.permissionsService.findAll(organizationId)
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @OrganizationId() organizationId: string): Promise<Permission> {
    return this.permissionsService.findOne(id, organizationId)
  }

  @Post()
  @Auth('admin')
  async create(
    @Body() body: { name: string; description?: string },
    @OrganizationId() organizationId: string,
  ): Promise<Permission> {
    return this.permissionsService.create(body.name, organizationId, body.description)
  }

  @Put(':id')
  @Auth('admin')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
    @OrganizationId() organizationId: string,
  ): Promise<Permission> {
    return this.permissionsService.update(id, organizationId, body.name, body.description)
  }
}
