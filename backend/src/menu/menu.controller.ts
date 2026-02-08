import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common'
import { MenuService } from './menu.service'
import { MenuItem } from './menu.entity'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { User } from '../users/user.entity'

@Controller('menu')
@UseGuards(JwtAuthGuard)
export class MenuController {
  constructor(private menuService: MenuService) {}

  @Get()
  async findAll(): Promise<MenuItem[]> {
    return this.menuService.findAll()
  }

  @Post('filtered')
  async findByPermissions(
    @Body() body: { permissions: string[] },
    @CurrentUser() user: User,
  ): Promise<MenuItem[]> {
    const userPermissions = body.permissions || []
    return this.menuService.findByPermissions(userPermissions)
  }

  @Post()
  async create(@Body() menuItem: Partial<MenuItem>): Promise<MenuItem> {
    return this.menuService.create(menuItem)
  }
}
