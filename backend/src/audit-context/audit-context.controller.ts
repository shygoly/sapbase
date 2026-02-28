import { Body, Controller, Get, Header, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { AuditContextService } from './audit-context.service'
import { CreateLabAuditLogDto } from './dto/create-lab-audit-log.dto'
import { QueryLabAuditLogDto } from './dto/query-lab-audit-log.dto'

@ApiTags('Lab Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lab/audit')
export class AuditContextController {
  constructor(private readonly auditService: AuditContextService) {}

  @Post('logs')
  append(
    @Body() dto: CreateLabAuditLogDto,
    @CurrentUser() user: { id: string },
    @OrganizationId() organizationId: string,
  ) {
    return this.auditService.append(dto, user.id, organizationId)
  }

  @Get('logs')
  query(@Query() filters: QueryLabAuditLogDto, @OrganizationId() organizationId: string) {
    return this.auditService.query(filters, organizationId)
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(@Query() filters: QueryLabAuditLogDto, @OrganizationId() organizationId: string) {
    return this.auditService.exportCsv(filters, organizationId)
  }
}
