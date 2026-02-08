import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common'
import { SettingsService } from './settings.service'
import { Setting } from './setting.entity'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  async findAll(): Promise<Setting[]> {
    return this.settingsService.findAll()
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Setting> {
    return this.settingsService.findOne(id)
  }

  @Post()
  async create(
    @Body() body: { key: string; value: string; description?: string },
  ): Promise<Setting> {
    return this.settingsService.create(body.key, body.value, body.description)
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { value: string },
  ): Promise<Setting> {
    return this.settingsService.update(id, body.value)
  }
}
