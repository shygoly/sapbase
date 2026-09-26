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
import { CurrentUser } from '../auth/current-user.decorator'
import { BlueprintService, DeliverError } from './blueprint.service'
import { PackageError } from './packager'
import { CompileError } from './compiler'
import { LoadError } from './loader'

const DELIVER_LICENSE_KEYS = new Set(['grantedTo', 'resell', 'expiresAt', 'issuer'])

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

  @Post(':id/deliver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '把模板目录产出为已授权、已签名的 .erpkg（先盖章再签名）',
  })
  async deliver(
    @Param('id') id: string,
    @Body()
    body: {
      grantedTo?: string[]
      resell?: boolean
      expiresAt?: string
      issuer?: string
      [key: string]: unknown
    },
  ) {
    const extra = Object.keys(body ?? {}).filter((key) => !DELIVER_LICENSE_KEYS.has(key))
    if (extra.length > 0) {
      throw new BadRequestException({
        message: `交付请求含未知字段：${extra.join(', ')}`,
        reason: 'unknown-field',
      })
    }
    if (!Array.isArray(body?.grantedTo)) {
      throw new BadRequestException({
        message: '缺少 grantedTo（租户数组）',
        reason: 'invalid-license',
      })
    }
    try {
      return await this.blueprints.deliver(id, {
        grantedTo: body.grantedTo,
        resell: body.resell,
        expiresAt: body.expiresAt,
        issuer: body.issuer,
      })
    } catch (error) {
      if (error instanceof DeliverError) {
        throw new BadRequestException({ message: error.message, reason: error.reason })
      }
      if (error instanceof PackageError) {
        throw new BadRequestException({ message: error.message, reason: error.reason })
      }
      if (error instanceof CompileError) {
        throw new BadRequestException({
          message: error.message,
          reason: error.reason,
          conflicts: error.conflicts,
        })
      }
      throw error
    }
  }

  @Get(':id/manifest')
  @ApiOperation({ summary: '读取蓝图包的清单' })
  manifest(@Param('id') id: string) {
    return this.blueprints.manifestOf(id)
  }

  @Post(':id/compile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '编译蓝图包，产出 IR（文本 + 结构）与依赖解析结果',
    description: 'body.stamp = true 时把 IR 摘要写回包内清单，供后续加载比对（防漂移）',
  })
  async compile(@Param('id') id: string, @Body() body?: { stamp?: boolean }) {
    try {
      const result = await this.blueprints.compile(id, { stamp: body?.stamp === true })
      return { ...result, stamped: body?.stamp === true }
    } catch (error) {
      if (error instanceof CompileError) {
        // 冲突明细一并返回：调用方要能逐条展示，而不是拿一句"编译失败"
        throw new BadRequestException({
          message: error.message,
          reason: error.reason,
          conflicts: error.conflicts,
        })
      }
      throw error
    }
  }

  @Post(':id/load')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '加载蓝图包为可执行计划（fail-closed：任一校验不过即拒）' })
  async load(
    @Param('id') id: string,
    @CurrentUser() user?: { organizationId?: string },
  ) {
    try {
      return await this.blueprints.load(id, { tenantId: user?.organizationId })
    } catch (error) {
      if (error instanceof LoadError) {
        throw new BadRequestException({ message: error.message, reason: error.reason })
      }
      if (error instanceof CompileError) {
        throw new BadRequestException({
          message: error.message,
          reason: error.reason,
          conflicts: error.conflicts,
        })
      }
      if (error instanceof PackageError) {
        throw new BadRequestException({ message: error.message, reason: error.reason })
      }
      throw error
    }
  }
}
