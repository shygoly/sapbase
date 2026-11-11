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
import { AuditAlertService } from './audit-alert.service'
import { AuditLog } from './audit-log.entity'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
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
    @Optional() private readonly alerts?: AuditAlertService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all audit logs with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  async findAll(
    @OrganizationId() organizationId: string,
    @CurrentUser() user?: { id?: string; email?: string },
    @Query('actor') actor?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('resourceId') resourceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe)
    pageSize: number = 10,
    @Query('source') source?: string,
    @Query('actorType') actorType?: string,
    @Query('correlationId') correlationId?: string,
    @Query('status') status?: string,
  ) {
    const filter: AuditLogFilterDto = {
      organizationId,
      source,
      actorType,
      correlationId,
      status: status as AuditLogFilterDto['status'],
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
    await this.auditLogsService.create({
      organizationId,
      action: 'audit.query',
      resource: 'audit_log',
      actor: user?.id ?? user?.email ?? 'unknown',
      status: 'success',
      metadata: { filter, total: result.total },
      source: 'api',
    })
    return PaginatedResponseDto.create(
      result.data,
      result.page,
      result.pageSize,
      result.total,
      'Audit logs retrieved successfully',
    )
  }

  @Get('alerts')
  @ApiOperation({ summary: '审计异常告警：登录失败/break-glass/验证失败/大批量导出/权限变更' })
  async evaluateAlerts(
    @OrganizationId() organizationId: string,
    @Query('windowMinutes', new DefaultValuePipe(1440), ParseIntPipe) windowMinutes: number,
  ) {
    if (!this.alerts) return { windowMinutes, alerts: [] }
    return this.alerts.evaluate(organizationId, windowMinutes)
  }

  @Get('archives')
  @ApiOperation({ summary: '审计归档列表' })
  async listArchives(@OrganizationId() organizationId: string) {
    if (!this.retention) return []
    return this.retention.listArchives(organizationId)
  }

  @Get('checkpoints')
  @ApiOperation({ summary: '审计检查点列表' })
  async listCheckpoints(@OrganizationId() organizationId: string) {
    if (!this.checkpoints) return []
    return this.checkpoints.list(organizationId)
  }

  @Post('restore')
  @ApiOperation({ summary: '从归档恢复审计日志（break-glass + 再验证）' })
  async restore(
    @OrganizationId() organizationId: string,
    @Body() body: { archiveId: string },
    @CurrentUser() user?: { id?: string; email?: string },
  ) {
    if (!this.retention) return { restored: 0, reason: 'retention 服务未装配' }
    return this.retention.restore(
      organizationId,
      body.archiveId,
      user?.id ?? user?.email ?? 'unknown',
    )
  }

  @Post(':id/legal-hold')
  @ApiOperation({ summary: '设置/解除法律保留（break-glass 留痕）' })
  async legalHold(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() body: { legalHold: boolean; reason?: string },
    @CurrentUser() user?: { id?: string; email?: string },
  ) {
    if (!this.retention) return { updated: false, reason: 'retention 服务未装配' }
    return this.retention.setLegalHold({
      organizationId,
      id,
      legalHold: body.legalHold,
      actor: user?.id ?? user?.email ?? 'unknown',
      reason: body.reason,
    })
  }

  @Get('verify')
  @ApiOperation({ summary: '验证本组织审计哈希链' })
  async verify(
    @OrganizationId() organizationId: string,
    @CurrentUser() user?: { id?: string; email?: string },
  ) {
    if (!this.verification) {
      return { valid: false, checked: 0, reason: '审计链验证服务未装配' }
    }
    const result = await this.verification.verify(organizationId)
    await this.auditLogsService.create({
      organizationId,
      action: 'audit.verify',
      resource: 'audit_log',
      actor: user?.id ?? user?.email ?? 'unknown',
      status: result.valid ? 'success' : 'failure',
      metadata: { checked: result.checked, brokenAt: result.brokenAt, reason: result.reason },
      source: 'api',
    })
    return result
  }

  @Post('checkpoint')
  @ApiOperation({ summary: '生成审计链检查点（HMAC 签名）' })
  async checkpoint(
    @OrganizationId() organizationId: string,
    @Body() body: { signer?: string },
    @CurrentUser() user?: { id?: string; email?: string },
  ) {
    if (!this.checkpoints) return { created: false, reason: 'checkpoint 服务未装配' }
    const result = await this.checkpoints.create(
      organizationId,
      body?.signer ?? user?.id ?? 'system',
    )
    await this.auditLogsService.create({
      organizationId,
      action: 'audit.checkpoint',
      resource: 'audit_log',
      actor: user?.id ?? user?.email ?? 'unknown',
      status: 'success',
      metadata: { seq: result?.seq ?? null },
      source: 'api',
    })
    return result
  }

  @Post('archive')
  @ApiOperation({ summary: '归档审计日志到对象存储（JSONL + manifest）' })
  async archive(
    @OrganizationId() organizationId: string,
    @Body() body: { toSeq: number },
    @CurrentUser() user?: { id?: string; email?: string },
  ) {
    if (!this.retention) return { archived: 0, reason: 'retention 服务未装配' }
    const result = await this.retention.archive(organizationId, body.toSeq)
    await this.auditLogsService.create({
      organizationId,
      action: 'audit.archive',
      resource: 'audit_log',
      actor: user?.id ?? user?.email ?? 'unknown',
      status: 'success',
      metadata: { ...result },
      source: 'api',
    })
    return result
  }

  @Post('cleanup')
  @ApiOperation({ summary: '清理已归档/过期/非 legalHold 审计日志' })
  async cleanup(
    @OrganizationId() organizationId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user?: { id?: string; email?: string },
  ) {
    if (!this.retention) return { deleted: 0, reason: 'retention 服务未装配' }
    const actor = user?.id ?? user?.email ?? 'unknown'
    const result = await this.retention.cleanup(organizationId, new Date(), {
      actor,
      reason: body?.reason,
    })
    return result
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific audit log by ID' })
  @ApiResponse({ status: 200, description: 'Audit log retrieved successfully' })
  async findOne(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user?: { id?: string; email?: string },
  ) {
    const log = await this.auditLogsService.findOne(id, organizationId)
    await this.auditLogsService.create({
      organizationId,
      action: 'audit.query',
      resource: 'audit_log',
      actor: user?.id ?? user?.email ?? 'unknown',
      status: 'success',
      resourceId: id,
      metadata: { detail: true },
      source: 'api',
    })
    return ApiResponseDto.success(log, 'Audit log retrieved successfully')
  }

  @Post()
  @ApiOperation({ summary: 'Create a new audit log' })
  @ApiResponse({ status: 201, description: 'Audit log created successfully' })
  async create(
    @OrganizationId() organizationId: string,
    @Body() createAuditLogDto: CreateAuditLogDto,
    @CurrentUser() user?: { id?: string; email?: string },
  ) {
    const log = await this.auditLogsService.create({
      ...createAuditLogDto,
      organizationId,
      actor: createAuditLogDto.actor ?? user?.id ?? user?.email ?? 'unknown',
    })
    return ApiResponseDto.created(log, 'Audit log created successfully')
  }

  @Post('export')
  @ApiOperation({ summary: 'Export audit logs as CSV or JSON' })
  @ApiResponse({ status: 200, description: 'Audit logs exported successfully' })
  async exportLogs(
    @OrganizationId() organizationId: string,
    @Body() filter: AuditLogFilterDto,
    @Query('format') format: 'csv' | 'json' = 'csv',
    @CurrentUser() user?: { id?: string; email?: string },
  ): Promise<StreamableFile> {
    const result = await this.auditLogsService.findAll({
      ...filter,
      organizationId,
      page: 1,
      pageSize: Math.min(5000, Math.max(1, filter?.pageSize ?? 5000)),
    })
    await this.auditLogsService.create({
      organizationId,
      action: 'audit.export',
      resource: 'audit_log',
      actor: user?.id ?? user?.email ?? 'unknown',
      status: 'success',
      metadata: { format, filter, rows: result.data.length },
      source: 'api',
    })

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
