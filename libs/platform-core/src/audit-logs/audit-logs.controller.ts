import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  StreamableFile,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { Optional } from '@nestjs/common'
import { AuditVerificationService } from './audit-verification.service'
import { AuditCheckpointService } from './audit-checkpoint.service'
import { AuditRetentionService } from './audit-retention.service'
import { AuditLogsService } from './audit-logs.service'
import { AuditLog } from './audit-log.entity'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AuditLogFilterDto, CreateAuditLogDto } from './dto'
import { ApiResponseDto, PaginatedResponseDto } from '../common'
import * as Papa from 'papaparse'

@ApiTags('Audit Logs')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditLogsController {
  constructor(
    private auditLogsService: AuditLogsService,
    @Optional() private readonly verification?: AuditVerificationService,
    @Optional() private readonly checkpoints?: AuditCheckpointService,
    @Optional() private readonly retention?: AuditRetentionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all audit logs with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  async findAll(
    @Query('actor') actor?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('resourceId') resourceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe)
    pageSize: number = 10,
  ) {
    const filter: AuditLogFilterDto = {
      actor,
      action,
      resource,
      resourceId,
      startDate,
      endDate,
      page,
      pageSize,
    }

    const result = await this.auditLogsService.findAll(filter)
    return PaginatedResponseDto.create(
      result.data,
      result.page,
      result.pageSize,
      result.total,
      'Audit logs retrieved successfully',
    )
  }

  @Get('verify')
  @ApiOperation({ summary: '验证本组织审计哈希链' })
  async verify(@Query('organizationId') organizationId?: string) {
    if (!this.verification) {
      return { valid: false, checked: 0, reason: '审计链验证服务未装配' }
    }
    if (!organizationId) {
      return { valid: false, checked: 0, reason: 'organizationId 必填' }
    }
    return this.verification.verify(organizationId)
  }

  @Post('checkpoint')
  @ApiOperation({ summary: '生成审计链检查点（HMAC 签名）' })
  async checkpoint(@Body() body: { organizationId: string; signer?: string }) {
    if (!this.checkpoints) return { created: false, reason: 'checkpoint 服务未装配' }
    return this.checkpoints.create(body.organizationId, body.signer)
  }

  @Post('archive')
  @ApiOperation({ summary: '归档审计日志到对象存储（JSONL + manifest）' })
  async archive(@Body() body: { organizationId: string; toSeq: number }) {
    if (!this.retention) return { archived: 0, reason: 'retention 服务未装配' }
    return this.retention.archive(body.organizationId, body.toSeq)
  }

  @Post('cleanup')
  @ApiOperation({ summary: '清理已归档/过期/非 legalHold 审计日志' })
  async cleanup(@Body() body: { organizationId: string }) {
    if (!this.retention) return { deleted: 0, reason: 'retention 服务未装配' }
    return { deleted: await this.retention.cleanup(body.organizationId) }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific audit log by ID' })
  @ApiResponse({ status: 200, description: 'Audit log retrieved successfully' })
  async findOne(@Param('id') id: string) {
    const log = await this.auditLogsService.findOne(id)
    return ApiResponseDto.success(log, 'Audit log retrieved successfully')
  }

  @Post()
  @ApiOperation({ summary: 'Create a new audit log' })
  @ApiResponse({ status: 201, description: 'Audit log created successfully' })
  async create(@Body() createAuditLogDto: CreateAuditLogDto) {
    const log = await this.auditLogsService.create(createAuditLogDto)
    return ApiResponseDto.created(log, 'Audit log created successfully')
  }

  @Post('export')
  @ApiOperation({ summary: 'Export audit logs as CSV or JSON' })
  @ApiResponse({ status: 200, description: 'Audit logs exported successfully' })
  async exportLogs(
    @Body() filter: AuditLogFilterDto,
    @Query('format') format: 'csv' | 'json' = 'csv',
  ): Promise<StreamableFile> {
    const result = await this.auditLogsService.findAll(filter)

    if (format === 'json') {
      const jsonData = JSON.stringify(result.data, null, 2)
      return new StreamableFile(Buffer.from(jsonData), {
        type: 'application/json',
        disposition: 'attachment; filename="audit-logs.json"',
      })
    }

    // CSV export
    const csv = Papa.unparse(result.data)
    return new StreamableFile(Buffer.from(csv), {
      type: 'text/csv',
      disposition: 'attachment; filename="audit-logs.csv"',
    })
  }
}
