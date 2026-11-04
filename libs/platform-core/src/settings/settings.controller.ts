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
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
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
  async findByUserId(@Request() req: any, @OrganizationId() organizationId: string) {
    const userId = req.user.id
    const settings = await this.settingsService.findByUserId(userId, organizationId)
    return ApiResponseDto.success(settings, 'Settings retrieved successfully')
  }

  @Post()
  @Auth()
  @ApiOperation({ summary: 'Create or initialize user settings' })
  @ApiResponse({ status: 201, description: 'Settings created successfully' })
  async create(
    @Request() req: any,
    @Body() createSettingDto: CreateSettingDto,
    @OrganizationId() organizationId: string,
  ) {
    const userId = req.user.id
    const settings = await this.settingsService.create(userId, createSettingDto, organizationId)
    return ApiResponseDto.created(settings, 'Settings created successfully')
  }

  @Put()
  @Auth()
  @ApiOperation({ summary: 'Update current user settings' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  async update(
    @Request() req: any,
    @Body() updateSettingDto: UpdateSettingDto,
    @OrganizationId() organizationId: string,
  ) {
    const userId = req.user.id
    const settings = await this.settingsService.update(userId, updateSettingDto, organizationId)
    return ApiResponseDto.success(settings, 'Settings updated successfully')
  }
}
