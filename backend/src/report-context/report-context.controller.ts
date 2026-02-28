import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { CreateLabReportDto } from './dto/create-lab-report.dto'
import { GenerateLabReportDto } from './dto/generate-lab-report.dto'
import { LabReportStatus } from './lab-report.entity'
import { ReportContextService } from './report-context.service'

@ApiTags('Lab Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lab/reports')
export class ReportContextController {
  constructor(private readonly reportService: ReportContextService) {}

  @Post()
  create(@Body() dto: CreateLabReportDto, @OrganizationId() organizationId: string) {
    return this.reportService.create(dto, organizationId)
  }

  @Get()
  list(@OrganizationId() organizationId: string, @Query('status') status?: LabReportStatus) {
    return this.reportService.list(organizationId, status)
  }

  @Get(':id')
  get(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.reportService.get(id, organizationId)
  }

  @Post(':id/generate')
  generate(
    @Param('id') id: string,
    @Body() dto: GenerateLabReportDto,
    @CurrentUser() user: { id: string },
    @OrganizationId() organizationId: string,
  ) {
    return this.reportService.generate(id, dto, user.id, organizationId)
  }

  @Post(':id/finalize')
  finalize(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @OrganizationId() organizationId: string,
  ) {
    return this.reportService.finalize(id, user.id, organizationId)
  }
}
