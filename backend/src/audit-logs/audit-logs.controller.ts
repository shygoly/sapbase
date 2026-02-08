import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common'
import { AuditLogsService } from './audit-logs.service'
import { AuditLog } from './audit-log.entity'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditLogsController {
  constructor(private auditLogsService: AuditLogsService) {}

  @Get()
  async findAll(): Promise<AuditLog[]> {
    return this.auditLogsService.findAll()
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<AuditLog> {
    return this.auditLogsService.findOne(id)
  }

  @Post()
  async create(@Body() auditLog: Partial<AuditLog>): Promise<AuditLog> {
    return this.auditLogsService.create(auditLog)
  }
}
