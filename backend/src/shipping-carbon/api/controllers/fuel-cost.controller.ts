import { Controller, Get, Query } from '@nestjs/common'
import { Auth } from '../../../common/decorators/auth.decorator'
import { OrganizationId } from '../../../organizations/decorators/organization-id.decorator'
import { ReportsService } from '../../application/services/reports.service'
import { ReportQueryDto } from '../../dto/report-query.dto'

@Controller('shipping')
@Auth()
export class FuelCostController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('reports/fuel-cost')
  getFuelCost(@Query() query: ReportQueryDto, @OrganizationId() organizationId: string) {
    return this.reportsService.getReport('fuel-cost', organizationId, query.shipId, query.year, query.fuelBasis)
  }
}
