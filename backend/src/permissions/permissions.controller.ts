import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common'
import { PermissionsService } from './permissions.service'
import { Permission } from './permission.entity'
import { Auth } from '../common/decorators/auth.decorator'

@Controller('permissions')
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
  @Auth('admin')
  async create(@Body() body: { name: string; description?: string }): Promise<Permission> {
    return this.permissionsService.create(body.name, body.description)
  }

  @Put(':id')
  @Auth('admin')
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
  ): Promise<Permission> {
    return this.permissionsService.update(id, body.name, body.description)
  }
}
