import { Body, Controller, Post } from '@nestjs/common'
import { Auth } from '../../../common/decorators/auth.decorator'
import { OrganizationId } from '../../../organizations/decorators/organization-id.decorator'
import { CurrentUser } from '../../../auth/current-user.decorator'
import { User } from '../../../users/user.entity'
import { ReportExportService } from '../../application/services/report-export.service'
import { ExportReportDto } from '../../dto/export-report.dto'

@Controller('shipping')
@Auth()
export class ReportExportController {
  constructor(private readonly reportExportService: ReportExportService) {}

  @Post('reports/export')
  exportReport(@Body() dto: ExportReportDto, @OrganizationId() organizationId: string, @CurrentUser() user: User) {
    return this.reportExportService.exportReport(dto, organizationId, user?.name)
  }
}
