import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  StreamableFile,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { OBJECT_STORAGE, type ObjectStorage } from '@sap/platform-core/assets/object-storage'
import { JobsService } from '@sap/platform-core/jobs/jobs.service'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import type { MetricsExportFormat } from './metrics-export.service'

interface RuntimeUser {
  id?: string
  email?: string
  permissions?: string[]
}

@ApiTags('Metrics')
@Controller('metrics/export')
export class MetricsExportController {
  constructor(
    private readonly jobs: JobsService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Post()
  @Auth('metrics:read')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '异步导出指标（csv/json/xlsx/pdf/md）' })
  async export(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: RuntimeUser | undefined,
    @Body()
    body: {
      format: MetricsExportFormat
      metricKeys: string[]
      from?: string
      to?: string
      dimensions?: string[]
    },
  ) {
    if (!body?.metricKeys?.length) throw new BadRequestException('metricKeys 必填')
    if (!['csv', 'json', 'xlsx', 'pdf', 'md'].includes(body.format)) {
      throw new BadRequestException('format 非法')
    }
    const actorId = user?.id ?? user?.email ?? 'unknown'
    const { job } = await this.jobs.create(
      organizationId,
      { userId: actorId, permissions: user?.permissions ?? ['metrics:read'] },
      {
        type: 'metrics.export',
        payload: {
          format: body.format,
          metricKeys: body.metricKeys,
          from: body.from,
          to: body.to,
          dimensions: body.dimensions,
          permissions: user?.permissions ?? ['metrics:read'],
          actorId,
        },
      },
    )
    return { jobId: job.id, status: job.status }
  }

  @Get(':jobId/download')
  @Auth('metrics:read')
  @ApiOperation({ summary: '下载指标导出文件' })
  async download(
    @OrganizationId() organizationId: string,
    @Param('jobId') jobId: string,
  ): Promise<StreamableFile> {
    const job = await this.jobs.get(organizationId, jobId)
    if (job.status !== 'succeeded') throw new BadRequestException(`任务状态 ${job.status}`)
    const result = job.result as { objectKey?: string; format?: string; mime?: string } | null
    if (!result?.objectKey) throw new NotFoundException('导出产物不存在')
    const buffer = await this.storage.get(result.objectKey)
    return new StreamableFile(buffer, {
      type: result.mime ?? 'application/octet-stream',
      disposition: `attachment; filename="metrics-export.${result.format ?? 'csv'}"`,
    })
  }
}
