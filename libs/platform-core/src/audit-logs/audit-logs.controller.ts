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
  constructor(private auditLogsService: AuditLogsService) {}

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
