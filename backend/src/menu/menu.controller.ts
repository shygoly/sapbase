import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common'
import { MenuService } from './menu.service'
import { MenuItem } from './menu.entity'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { User } from '../users/user.entity'
import { CreateMenuItemDto } from './dto/create-menu-item.dto'
import { UpdateMenuItemDto } from './dto/update-menu-item.dto'

@Controller('menu')
export class MenuController {
  constructor(private menuService: MenuService) {}

  @Get()
  @Auth()
  async findAll(@CurrentUser() user: User, @OrganizationId() organizationId: string): Promise<MenuItem[]> {
    // Return all menu items, let frontend filter by permissions
    // This allows the frontend to show menu structure even if user doesn't have all permissions
    return this.menuService.findAll(organizationId)
  }

  @Get(':id')
  @Auth()
  async findOne(@Param('id') id: string, @OrganizationId() organizationId: string): Promise<MenuItem | null> {
    return this.menuService.findOne(id, organizationId)
  }

  @Post('filtered')
  @Auth()
  async findByPermissions(
    @Body() body: { permissions: string[] },
    @CurrentUser() user: User,
    @OrganizationId() organizationId: string,
  ): Promise<MenuItem[]> {
    const userPermissions = body.permissions || []
    return this.menuService.findByPermissions(userPermissions, organizationId)
  }

  @Post()
  @Auth('menu:create')
  async create(@Body() dto: CreateMenuItemDto, @OrganizationId() organizationId: string): Promise<MenuItem> {
    return this.menuService.create(dto, organizationId)
  }

  @Patch(':id')
  @Auth('menu:update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemDto,
    @OrganizationId() organizationId: string,
  ): Promise<MenuItem | null> {
    return this.menuService.update(id, dto, organizationId)
  }

  @Delete(':id')
  @Auth('menu:delete')
  async remove(@Param('id') id: string, @OrganizationId() organizationId: string): Promise<void> {
    return this.menuService.remove(id, organizationId)
  }

  @Post('reorder')
  @Auth('menu:update')
  async reorder(
    @Body() body: { items: { id: string; order: number }[] },
    @OrganizationId() organizationId: string,
  ): Promise<MenuItem[]> {
    return this.menuService.reorder(body.items, organizationId)
  }
}
