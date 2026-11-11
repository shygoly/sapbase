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
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '@sap/platform-core/assets/object-storage'
import { JobsService } from '@sap/platform-core/jobs/jobs.service'
import { Auth } from '@sap/platform-core/common/decorators/auth.decorator'
import { CurrentUser } from '@sap/platform-core/auth/current-user.decorator'
import { OrganizationId } from '@sap/platform-core/organizations/decorators/organization-id.decorator'
import type { AuditExportFilter, AuditExportFormat } from './audit-export-job.service'

interface RuntimeUser {
  id?: string
  email?: string
  permissions?: string[]
}

const MIME: Record<string, string> = {
  csv: 'text/csv',
  json: 'application/json',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
}

@ApiTags('Audit Export')
@Controller('audit-exports')
export class AuditExportsController {
  constructor(
    private readonly jobs: JobsService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Post()
  @Auth('audit-logs:read')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '异步导出审计（csv/json/xlsx/pdf）' })
  async create(
    @OrganizationId() organizationId: string,
    @Body() body: { format: AuditExportFormat; filter?: AuditExportFilter },
    @CurrentUser() user?: RuntimeUser,
  ) {
    const format = body?.format
    if (!format || !['csv', 'json', 'xlsx', 'pdf'].includes(format)) {
      throw new BadRequestException('format 必须是 csv/json/xlsx/pdf')
    }
    const { job } = await this.jobs.create(
      organizationId,
      {
        userId: user?.id ?? user?.email ?? 'unknown',
        permissions: user?.permissions ?? ['audit-logs:read'],
      },
      {
        type: 'audit.export',
        payload: { format, filter: body.filter ?? {} },
        idempotencyKey: `audit-export:${organizationId}:${Date.now()}`,
      },
    )
    return { jobId: job.id, status: job.status }
  }

  @Get(':jobId')
  @Auth('audit-logs:read')
  @ApiOperation({ summary: '查询异步导出任务' })
  async get(@OrganizationId() organizationId: string, @Param('jobId') jobId: string) {
    const job = await this.jobs.get(organizationId, jobId)
    return {
      id: job.id,
      status: job.status,
      result: job.result ?? null,
      error: job.error ?? null,
      progress: job.progress,
    }
  }

  @Get(':jobId/download')
  @Auth('audit-logs:read')
  @ApiOperation({ summary: '下载异步导出文件' })
  async download(
    @OrganizationId() organizationId: string,
    @Param('jobId') jobId: string,
  ): Promise<StreamableFile> {
    const job = await this.jobs.get(organizationId, jobId)
    if (job.status !== 'succeeded') throw new BadRequestException(`任务状态 ${job.status}`)
    const result = job.result as
      | { objectKey?: string; format?: string; mime?: string }
      | null
      | undefined
    if (!result?.objectKey) throw new NotFoundException('导出产物不存在')
    const buffer = await this.storage.get(result.objectKey)
    return new StreamableFile(buffer, {
      type: result.mime ?? MIME[result.format ?? 'csv'] ?? 'application/octet-stream',
      disposition: `attachment; filename="audit-export.${result.format ?? 'csv'}"`,
    })
  }
}
