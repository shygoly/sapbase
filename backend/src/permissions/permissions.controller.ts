import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common'
import { PermissionsService } from './permissions.service'
import { Permission } from './permission.entity'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'

@Controller('permissions')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  @Get()
  async findAll(): Promise<Permission[]> {
    return this.permissionsService.findAll()
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Permission> {
    return this.permissionsService.findOne(id)
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async create(@Body() body: { name: string; description?: string }): Promise<Permission> {
    return this.permissionsService.create(body.name, body.description)
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
  ): Promise<Permission> {
    return this.permissionsService.update(id, body.name, body.description)
  }
}
