import { Body, Controller, Post } from '@nestjs/common'
import { Auth } from '../../../common/decorators/auth.decorator'
import { OrganizationId } from '../../../organizations/decorators/organization-id.decorator'
import { CurrentUser } from '../../../auth/current-user.decorator'
import { User } from '../../../users/user.entity'
import { ReportsService } from '../../application/services/reports.service'
import { RecalculateReportDto } from '../../dto/recalculate-report.dto'

@Controller('shipping')
@Auth()
export class RecalculateController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('recalculate')
  recalculate(@Body() dto: RecalculateReportDto, @OrganizationId() organizationId: string, @CurrentUser() user: User) {
    return this.reportsService.recalculateReport(dto.framework, organizationId, dto.shipId, dto.year, user?.name, dto.fuelBasis)
  }
}
