import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Param,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PluginLifecycleService } from './application/services/plugin-lifecycle.service'
import { GetPluginsService } from './application/services/get-plugins.service'
import { PluginRegistryService } from './application/services/plugin-registry.service'
import { multerConfig } from '../common/storage/multer.config'
import * as fs from 'fs/promises'
import * as path from 'path'

@ApiTags('Plugins')
@Controller('plugins')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PluginsController {
  constructor(
    private readonly pluginLifecycleService: PluginLifecycleService,
    private readonly getPluginsService: GetPluginsService,
    private readonly pluginRegistryService: PluginRegistryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all plugins for organization' })
  async listPlugins(@Request() req: any) {
    const organizationId = (req as any).organizationId
    return this.getPluginsService.findAll(organizationId)
  }

  @Post('install')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Install a plugin from ZIP file' })
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
  async installPlugin(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided')
    }

    const organizationId = (req as any).organizationId

    // Save uploaded file temporarily
    const tempDir = path.join(process.cwd(), 'tmp')
    await fs.mkdir(tempDir, { recursive: true })
    const tempPath = path.join(tempDir, `plugin-${Date.now()}.zip`)
    await fs.writeFile(tempPath, file.buffer)

    try {
      const plugin = await this.pluginLifecycleService.install({
        zipPath: tempPath,
        organizationId,
      })

      return {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        type: plugin.type,
        status: plugin.status,
      }
    } finally {
      // Clean up temp file
      await fs.unlink(tempPath).catch(() => {})
    }
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate a plugin' })
  async activatePlugin(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const organizationId = (req as any).organizationId
    const plugin = await this.pluginLifecycleService.activate({
      pluginId: id,
      organizationId,
    })

    return {
      id: plugin.id,
      name: plugin.name,
      status: plugin.status,
    }
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a plugin' })
  async deactivatePlugin(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const organizationId = (req as any).organizationId
    const plugin = await this.pluginLifecycleService.deactivate({
      pluginId: id,
      organizationId,
    })

    return {
      id: plugin.id,
      name: plugin.name,
      status: plugin.status,
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Uninstall a plugin' })
  async uninstallPlugin(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const organizationId = (req as any).organizationId
    await this.pluginLifecycleService.uninstall({
      pluginId: id,
      organizationId,
    })

    return { message: 'Plugin uninstalled successfully' }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get plugin metadata' })
  async getPlugin(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const organizationId = (req as any).organizationId
    return this.getPluginsService.findOne(id, organizationId)
  }

  @Get('registry')
  @ApiOperation({ summary: 'Browse available plugins in registry' })
  async browseRegistry() {
    const plugins = await this.pluginRegistryService.listAvailablePlugins()
    return {
      plugins: plugins.map((p) => ({
        name: p.name,
        version: p.version,
        type: p.type,
        description: p.description,
        author: p.author,
        license: p.license,
      })),
    }
  }
}
