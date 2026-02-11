import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Request,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { SettingsService } from './settings.service'
import { Auth } from '../common/decorators/auth.decorator'
import { CreateSettingDto, UpdateSettingDto, SettingResponseDto } from './dto'
import { ApiResponseDto } from '../common'

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Get current user settings' })
  @ApiResponse({ status: 200, description: 'Settings retrieved successfully' })
  async findByUserId(@Request() req: any) {
    const userId = req.user.id
    const settings = await this.settingsService.findByUserId(userId)
    return ApiResponseDto.success(settings, 'Settings retrieved successfully')
  }

  @Post()
  @Auth()
  @ApiOperation({ summary: 'Create or initialize user settings' })
  @ApiResponse({ status: 201, description: 'Settings created successfully' })
  async create(
    @Request() req: any,
    @Body() createSettingDto: CreateSettingDto,
  ) {
    const userId = req.user.id
    const settings = await this.settingsService.create(userId, createSettingDto)
    return ApiResponseDto.created(settings, 'Settings created successfully')
  }

  @Put()
  @Auth()
  @ApiOperation({ summary: 'Update current user settings' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  async update(
    @Request() req: any,
    @Body() updateSettingDto: UpdateSettingDto,
  ) {
    const userId = req.user.id
    const settings = await this.settingsService.update(userId, updateSettingDto)
    return ApiResponseDto.success(settings, 'Settings updated successfully')
  }
}
