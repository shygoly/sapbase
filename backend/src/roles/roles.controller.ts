import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { RolesService } from './roles.service'
import { CreateRoleDto } from './dto/create-role.dto'
import { UpdateRoleDto } from './dto/update-role.dto'
import { Auth } from '../common/decorators/auth.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { Role } from './role.entity'

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Auth('admin')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createRoleDto: CreateRoleDto, @OrganizationId() organizationId: string): Promise<Role> {
    return this.rolesService.create(createRoleDto, organizationId)
  }

  @Get()
  async findAll(@OrganizationId() organizationId: string): Promise<Role[]> {
    return this.rolesService.findAll(organizationId)
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @OrganizationId() organizationId: string): Promise<Role> {
    return this.rolesService.findOne(id, organizationId)
  }

  @Put(':id')
  @Auth('admin')
  async update(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @OrganizationId() organizationId: string,
  ): Promise<Role> {
    return this.rolesService.update(id, updateRoleDto, organizationId)
  }

  @Delete(':id')
  @Auth('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @OrganizationId() organizationId: string): Promise<void> {
    return this.rolesService.remove(id, organizationId)
  }
}
