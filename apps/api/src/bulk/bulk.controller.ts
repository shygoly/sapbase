import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { memoryStorage } from 'multer'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { BULK_LIMITS } from './bulk-formats'
import { BulkService, actorOf, type BulkUser } from './bulk.service'
import type { ExportFormat } from './bulk.entities'

const uploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: BULK_LIMITS.maxFileBytes, files: 1 },
}

function parseObject(value: unknown, label: string): Record<string, unknown> {
  if (value === undefined || value === null || value === '') return {}
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      throw new BadRequestException(`${label} 必须是 JSON 对象`)
    }
  }
  throw new BadRequestException(`${label} 必须是 JSON 对象`)
}

function parseFields(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map((item) => String(item))
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.split(',').map((item) => item.trim()).filter(Boolean)
  }
  return undefined
}

@ApiTags('Bulk Import')
@Controller('imports')
export class BulkImportsController {
  constructor(private readonly bulk: BulkService) {}

  @Get('resources')
  @Auth('imports:read')
  @ApiOperation({ summary: '已注册的导入/导出资源与字段定义' })
  resources(@OrganizationId() organizationId: string, @CurrentUser() user?: BulkUser) {
    return this.bulk.listResources(organizationId, actorOf(user))
  }

  @Get('resource')
  @Auth('imports:read')
  @ApiOperation({ summary: '单个资源描述（导入字段/必填/枚举/引用/示例）' })
  resource(
    @OrganizationId() organizationId: string,
    @Query('resourceKey') resourceKey: string,
    @Query('direction') direction: 'import' | 'export' = 'import',
    @CurrentUser() user?: BulkUser,
  ) {
    if (!resourceKey) throw new BadRequestException('resourceKey 必填')
    return this.bulk.describe(organizationId, actorOf(user), resourceKey, direction)
  }

  @Get('template')
  @Auth('imports:read')
  @ApiOperation({ summary: '下载导入模板（csv/xlsx，含必填标记与示例）' })
  async template(
    @OrganizationId() organizationId: string,
    @Query('resourceKey') resourceKey: string,
    @Query('format') format: 'csv' | 'xlsx' = 'xlsx',
    @CurrentUser() user?: BulkUser,
  ): Promise<StreamableFile> {
    if (!resourceKey) throw new BadRequestException('resourceKey 必填')
    if (format !== 'csv' && format !== 'xlsx') {
      throw new BadRequestException('format 必须是 csv 或 xlsx')
    }
    const result = await this.bulk.template(
      organizationId,
      actorOf(user),
      resourceKey,
      format,
    )
    return new StreamableFile(result.buffer, {
      type: result.mimeType,
      disposition: `attachment; filename="${result.filename}"`,
    })
  }

  @Post()
  @Auth('imports:manage')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  @ApiOperation({ summary: '创建导入运行（multipart file 或 JSON assetId）' })
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: BulkUser | undefined,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @Body()
    body: Record<string, unknown>,
  ) {
    if (!body?.resourceKey) throw new BadRequestException('resourceKey 必填')
    return this.bulk.createImport(organizationId, actorOf(user), {
      resourceKey: String(body.resourceKey),
      mode: body.mode === 'atomic' ? 'atomic' : 'partial',
      dryRun: body.dryRun === true || body.dryRun === 'true',
      idempotencyKey:
        idempotencyHeader ?? (body.idempotencyKey ? String(body.idempotencyKey) : undefined),
      mapping: parseObject(body.mapping, 'mapping'),
      mappingName: body.mappingName ? String(body.mappingName) : undefined,
      unknownColumns: body.unknownColumns === 'ignore' ? 'ignore' : 'reject',
      assetId: body.assetId ? String(body.assetId) : undefined,
      file: file
        ? {
            buffer: file.buffer,
            originalName: file.originalname,
            mimeType: file.mimetype,
          }
        : undefined,
    })
  }

  @Get()
  @Auth('imports:read')
  @ApiOperation({ summary: '导入运行历史' })
  list(
    @OrganizationId() organizationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.bulk.listImports(organizationId, limit ? Number(limit) : undefined)
  }

  @Get(':id')
  @Auth('imports:read')
  @ApiOperation({ summary: '导入运行详情（状态/进度/错误）' })
  get(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.bulk.getImport(organizationId, id)
  }

  @Get(':id/errors')
  @Auth('imports:read')
  @ApiOperation({ summary: '下载错误报告 CSV（行/列/字段/原因）' })
  async errors(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user?: BulkUser,
  ): Promise<StreamableFile> {
    const result = await this.bulk.importErrorsCsv(organizationId, id, actorOf(user))
    return new StreamableFile(result.buffer, {
      type: 'text/csv',
      disposition: `attachment; filename="${result.filename}"`,
    })
  }

  @Post(':id/cancel')
  @Auth('imports:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取消导入运行' })
  cancel(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user?: BulkUser,
  ) {
    return this.bulk.cancelImport(organizationId, actorOf(user), id)
  }

  @Post(':id/retry')
  @Auth('imports:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重试失败/取消/部分成功的导入' })
  retry(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user?: BulkUser,
  ) {
    return this.bulk.retryImport(organizationId, actorOf(user), id)
  }
}

@ApiTags('Bulk Export')
@Controller('exports')
export class BulkExportsController {
  constructor(private readonly bulk: BulkService) {}

  @Post()
  @Auth('exports:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建异步导出（资源/筛选/排序/字段/格式）' })
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: BulkUser | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    if (!body?.resourceKey) throw new BadRequestException('resourceKey 必填')
    return this.bulk.createExport(organizationId, actorOf(user), {
      resourceKey: String(body.resourceKey),
      format: body.format ? (String(body.format) as ExportFormat) : 'csv',
      fields: parseFields(body.fields),
      filter: parseObject(body.filter, 'filter'),
      sort: body.sort ? String(body.sort) : undefined,
      order: body.order === 'asc' ? 'asc' : 'desc',
      search: body.search ? String(body.search) : undefined,
      restrictedFieldPolicy: body.restrictedFieldPolicy === 'reject' ? 'reject' : 'omit',
      piiPolicy: body.piiPolicy === 'mask' ? 'mask' : 'allow',
    })
  }

  @Get()
  @Auth('exports:read')
  @ApiOperation({ summary: '导出运行历史（过期结果自动清理/标记）' })
  list(
    @OrganizationId() organizationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.bulk.listExports(organizationId, limit ? Number(limit) : undefined)
  }

  @Get(':id')
  @Auth('exports:read')
  @ApiOperation({ summary: '导出运行详情' })
  get(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.bulk.getExport(organizationId, id)
  }

  @Get(':id/download')
  @Auth('exports:read')
  @ApiOperation({ summary: '下载导出结果（鉴权 + 有效期检查）' })
  async download(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user?: BulkUser,
  ): Promise<StreamableFile> {
    const result = await this.bulk.exportDownload(organizationId, actorOf(user), id)
    return new StreamableFile(result.buffer, {
      type: result.run.mimeType ?? 'application/octet-stream',
      disposition: `attachment; filename="${result.filename}"`,
    })
  }

  @Get(':id/url')
  @Auth('exports:read')
  @ApiOperation({ summary: '签发短时下载 URL' })
  async url(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Query('ttl') ttl: string | undefined,
    @CurrentUser() user?: BulkUser,
  ) {
    return this.bulk.exportSignedUrl(
      organizationId,
      actorOf(user),
      id,
      ttl ? Number(ttl) : 300,
    )
  }

  @Post(':id/cancel')
  @Auth('exports:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取消导出运行' })
  cancel(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user?: BulkUser,
  ) {
    return this.bulk.cancelExport(organizationId, actorOf(user), id)
  }
}

@ApiTags('Bulk Import')
@Controller('import-mappings')
export class BulkImportMappingsController {
  constructor(private readonly bulk: BulkService) {}

  @Get()
  @Auth('imports:read')
  @ApiOperation({ summary: '列出入表头映射' })
  list(
    @OrganizationId() organizationId: string,
    @Query('resourceKey') resourceKey?: string,
  ) {
    return this.bulk.listMappings(organizationId, resourceKey)
  }

  @Post()
  @Auth('imports:manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '保存入表头映射（按资源+名称 upsert）' })
  save(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: BulkUser | undefined,
    @Body() body: { resourceKey?: string; name?: string; mapping?: Record<string, unknown> },
  ) {
    if (!body?.resourceKey || !body?.name) {
      throw new BadRequestException('resourceKey/name 必填')
    }
    return this.bulk.saveMapping(organizationId, actorOf(user), {
      resourceKey: body.resourceKey,
      name: body.name,
      mapping: body.mapping ?? {},
    })
  }

  @Delete(':id')
  @Auth('imports:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除入表头映射' })
  async remove(@OrganizationId() organizationId: string, @Param('id') id: string) {
    await this.bulk.deleteMapping(organizationId, id)
  }
}
