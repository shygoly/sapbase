import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common'
import { AIModelsService } from './ai-models.service'
import { ModelProfileService } from './model-profile.service'
import { Auth } from '../common/decorators/auth.decorator'

@Controller('ai-models')
export class AIModelsController {
  constructor(
    private readonly aiModelsService: AIModelsService,
    private readonly profiles: ModelProfileService,
  ) {}

  @Get()
  @Auth('system:manage')
  async findAll(): Promise<Array<Record<string, unknown>>> {
    const models = await this.aiModelsService.findAll()
    return models.map((model) => this.aiModelsService.toPublic(model))
  }

  @Get('profiles')
  @Auth('system:manage')
  async listProfiles() {
    return this.profiles.list()
  }

  @Get('default')
  @Auth()
  async findDefault(): Promise<Record<string, unknown> | null> {
    const model = await this.aiModelsService.findDefault()
    return model ? this.aiModelsService.toPublic(model) : null
  }

  @Get(':id')
  @Auth('system:manage')
  async findOne(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.aiModelsService.toPublic(await this.aiModelsService.findOne(id))
  }

  @Post()
  @Auth('system:manage')
  async create(@Body() createDto: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.aiModelsService.toPublic(await this.aiModelsService.create(createDto))
  }

  @Patch(':id')
  @Auth('system:manage')
  async update(@Param('id') id: string, @Body() updateDto: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.aiModelsService.toPublic(await this.aiModelsService.update(id, updateDto))
  }

  @Delete(':id')
  @Auth('system:manage')
  async remove(@Param('id') id: string): Promise<void> {
    return this.aiModelsService.delete(id)
  }

  @Post(':id/test')
  @Auth('system:manage')
  async testConnection(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    return this.aiModelsService.testConnection(id)
  }
}
