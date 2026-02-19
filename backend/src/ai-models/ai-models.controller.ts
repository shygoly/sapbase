import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common'
import { AIModelsService } from './ai-models.service'
import { AIModel } from './ai-model.entity'
import { Auth } from '../common/decorators/auth.decorator'

@Controller('ai-models')
export class AIModelsController {
  constructor(private readonly aiModelsService: AIModelsService) {}

  @Get()
  @Auth('system:manage')
  async findAll(): Promise<AIModel[]> {
    return this.aiModelsService.findAll()
  }

  @Get('default')
  @Auth()
  async findDefault(): Promise<AIModel | null> {
    return this.aiModelsService.findDefault()
  }

  @Get(':id')
  @Auth('system:manage')
  async findOne(@Param('id') id: string): Promise<AIModel> {
    return this.aiModelsService.findOne(id)
  }

  @Post()
  @Auth('system:manage')
  async create(@Body() createDto: Partial<AIModel>): Promise<AIModel> {
    return this.aiModelsService.create(createDto)
  }

  @Patch(':id')
  @Auth('system:manage')
  async update(@Param('id') id: string, @Body() updateDto: Partial<AIModel>): Promise<AIModel> {
    return this.aiModelsService.update(id, updateDto)
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
