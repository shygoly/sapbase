import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { BlueprintService } from './blueprint.service'
import { PackageError } from './packager'

/**
 * 蓝图包的 HTTP 入口（B2）。
 *
 * v1 的"注册表"是服务器上的一个目录（`BLUEPRINT_PACKAGES_DIR`），
 * 因此 `:id` 是包文件名去掉 `.erpkg`。升级成数据库注册表时接口形态不变。
 */
@ApiTags('Blueprints')
@Controller('blueprints')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BlueprintController {
  constructor(private readonly blueprints: BlueprintService) {}

  @Get()
  @ApiOperation({ summary: '列出蓝图包' })
  list() {
    return this.blueprints.list()
  }

  @Post('package')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '把服务器上的蓝图目录打包为 .erpkg' })
  package(@Body() body: { dir?: string; out?: string }) {
    if (!body?.dir) {
      throw new BadRequestException('缺少 dir（蓝图目录，服务器路径）')
    }
    try {
      return this.blueprints.packageFrom(body.dir, body.out)
    } catch (error) {
      if (error instanceof PackageError) {
        // 打包失败的原因必须原样透出（io / invalid-manifest），否则排查只能靠猜
        throw new BadRequestException(`打包失败[${error.reason}]：${error.message}`)
      }
      throw error
    }
  }

  @Get(':id/manifest')
  @ApiOperation({ summary: '读取蓝图包的清单' })
  manifest(@Param('id') id: string) {
    return this.blueprints.manifestOf(id)
  }
}
