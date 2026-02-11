import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common'
import { MenuService } from './menu.service'
import { MenuItem } from './menu.entity'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { User } from '../users/user.entity'
import { CreateMenuItemDto } from './dto/create-menu-item.dto'
import { UpdateMenuItemDto } from './dto/update-menu-item.dto'

@Controller('menu')
export class MenuController {
  constructor(private menuService: MenuService) {}

  @Get()
  @Auth()
  async findAll(): Promise<MenuItem[]> {
    return this.menuService.findAll()
  }

  @Get(':id')
  @Auth()
  async findOne(@Param('id') id: string): Promise<MenuItem | null> {
    return this.menuService.findOne(id)
  }

  @Post('filtered')
  @Auth()
  async findByPermissions(
    @Body() body: { permissions: string[] },
    @CurrentUser() user: User,
  ): Promise<MenuItem[]> {
    const userPermissions = body.permissions || []
    return this.menuService.findByPermissions(userPermissions)
  }

  @Post()
  @Auth('menu:create')
  async create(@Body() dto: CreateMenuItemDto): Promise<MenuItem> {
    return this.menuService.create(dto)
  }

  @Patch(':id')
  @Auth('menu:update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemDto,
  ): Promise<MenuItem | null> {
    return this.menuService.update(id, dto)
  }

  @Delete(':id')
  @Auth('menu:delete')
  async remove(@Param('id') id: string): Promise<void> {
    return this.menuService.remove(id)
  }

  @Post('reorder')
  @Auth('menu:update')
  async reorder(
    @Body() body: { items: { id: string; order: number }[] },
  ): Promise<MenuItem[]> {
    return this.menuService.reorder(body.items)
  }
}
