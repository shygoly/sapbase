import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { GetBrandConfigService } from '../organization-context/application/services/get-brand-config.service'
import { UpdateBrandConfigService } from '../organization-context/application/services/update-brand-config.service'
import { UpdateBrandConfigDto } from './dto/update-brand-config.dto'
import { StorageService } from '../common/storage/storage.service'
import { multerConfig } from '../common/storage/multer.config'

@ApiTags('Brand Config')
@Controller('organizations/:organizationId/brand-config')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BrandConfigController {
  constructor(
    private readonly getBrandConfigService: GetBrandConfigService,
    private readonly updateBrandConfigService: UpdateBrandConfigService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get brand configuration for organization' })
  async getBrandConfig(
    @Param('organizationId') organizationId: string,
  ) {
    return this.getBrandConfigService.execute({ organizationId })
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update brand configuration for organization' })
  async updateBrandConfig(
    @Param('organizationId') organizationId: string,
    @Body() dto: UpdateBrandConfigDto,
  ) {
    return this.updateBrandConfigService.execute({
      organizationId,
      ...dto,
    })
  }

  @Post('upload-logo')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload logo file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadLogo(
    @Param('organizationId') organizationId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided')
    }

    const uploadedFile = await this.storageService.uploadFile(file, 'brand')

    // Update brand config with new logo URL
    const config = await this.updateBrandConfigService.execute({
      organizationId,
      logoUrl: uploadedFile.url,
    })

    return {
      ...uploadedFile,
      config,
    }
  }

  @Post('upload-favicon')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload favicon file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadFavicon(
    @Param('organizationId') organizationId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided')
    }

    const uploadedFile = await this.storageService.uploadFile(file, 'brand')

    // Update brand config with new favicon URL
    const config = await this.updateBrandConfigService.execute({
      organizationId,
      faviconUrl: uploadedFile.url,
    })

    return {
      ...uploadedFile,
      config,
    }
  }
}
