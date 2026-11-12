import {
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Body,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { JobsService } from '@sap/platform-core/jobs/jobs.service'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { AssetsService } from './assets.service'

interface RuntimeUser {
  id?: string
  userId?: string
  permissions?: string[]
}

@ApiTags('Assets')
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly assets: AssetsService,
    private readonly jobs: JobsService,
  ) {}

  @Get()
  @Auth('assets:read')
  @ApiOperation({ summary: '资产列表（按组织）' })
  list(
    @OrganizationId() organizationId: string,
    @Query('status') status?: string,
    @Query('kind') kind?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.assets.list(organizationId, {
      status: status as never,
      kind: kind as never,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    })
  }

  @Get('usage')
  @Auth('assets:read')
  @ApiOperation({ summary: '组织资产用量/配额/并发上传' })
  usage(@OrganizationId() organizationId: string) {
    return this.assets.usage(organizationId)
  }

  @Patch('quota')
  @Auth('assets:write')
  @ApiOperation({ summary: '管理员调整组织资产配额（bytes）' })
  setQuota(
    @OrganizationId() organizationId: string,
    @Body() body: { limitBytes?: number },
  ) {
    return this.assets.setQuota(organizationId, Number(body?.limitBytes))
  }

  @Get('public/:id/content')
  @ApiOperation({ summary: '公开资产内容（仅 isPublic=true 且 ready）' })
  async publicContent(@Param('id') id: string): Promise<StreamableFile> {
    const { asset, body } = await this.assets.readPublic(id)
    return new StreamableFile(body, { type: asset.mimeType })
  }

  @Get(':id')
  @Auth('assets:read')
  @ApiOperation({ summary: '资产详情' })
  get(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.assets.get(organizationId, id)
  }

  @Get(':id/variants')
  @Auth('assets:read')
  @ApiOperation({ summary: '资产变体（缩略图/预览/转码）' })
  variants(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.assets.listVariants(organizationId, id)
  }

  @Get(':id/variants/urls')
  @Auth('assets:read')
  @ApiOperation({ summary: '资产变体短时签名 URL' })
  variantUrls(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Query('ttl') ttl?: string,
  ) {
    return this.assets.signedVariantUrls(
      organizationId,
      id,
      ttl ? Number(ttl) : undefined,
    )
  }

  @Get(':id/download')
  @Auth('assets:read')
  @ApiOperation({ summary: '签发短时下载 URL；非 ready 拒绝' })
  download(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Query('ttl') ttl?: string,
  ) {
    return this.assets.downloadUrl(organizationId, id, ttl ? Number(ttl) : undefined)
  }

  @Get(':id/content')
  @Auth('assets:read')
  @ApiOperation({ summary: 'Range 串流资产内容（视频/音频）' })
  async content(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Headers('range') range: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const totalAsset = await this.assets.get(organizationId, id)
    const total = Number(totalAsset.size)
    const match = /^bytes=(\d*)-(\d*)$/.exec(range ?? '')
    const start = match?.[1] ? Number(match[1]) : 0
    const end = match?.[2] ? Number(match[2]) : Math.max(0, total - 1)
    const result = await this.assets.readRange(organizationId, id, start, end + 1)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Type', result.asset.mimeType)
    if (range) {
      res.status(206)
      res.setHeader(
        'Content-Range',
        `bytes ${start}-${start + result.body.length - 1}/${result.total}`,
      )
    }
    res.setHeader('Content-Length', String(result.body.length))
    return new StreamableFile(result.body)
  }

  @Post(':id/process')
  @Auth('assets:write')
  @ApiOperation({ summary: '重新入队扫描/处理（failed/quarantined 可重试）' })
  async process(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user?: RuntimeUser,
  ) {
    const asset = await this.assets.get(organizationId, id)
    const { job } = await this.jobs.create(
      organizationId,
      {
        userId: user?.userId ?? user?.id ?? 'system',
        permissions: ['jobs:manage'],
      },
      {
        type: 'asset.process',
        payload: { assetId: asset.id },
        idempotencyKey: `asset.process:${asset.id}:${Date.now()}`,
      },
    )
    return { assetId: asset.id, jobId: job.id }
  }

  @Post('cleanup')
  @Auth('assets:write')
  @ApiOperation({ summary: '清理到期资产（仍被记录引用则顺延）' })
  cleanup(@OrganizationId() organizationId: string) {
    return this.assets.cleanupExpired(organizationId)
  }

  @Delete(':id')
  @Auth('assets:write')
  @ApiOperation({ summary: '软删除资产' })
  remove(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.assets.softDelete(organizationId, id)
  }
}
