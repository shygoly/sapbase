import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '@sap/platform-core/common/decorators/auth.decorator'
import { OrganizationId } from '@sap/platform-core/organizations/decorators/organization-id.decorator'
import { DashboardService } from './dashboard.service'

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @Auth()
  @ApiOperation({ summary: '当前组织的仪表盘汇总' })
  summary(@OrganizationId() organizationId: string) {
    return this.dashboard.summary(organizationId)
  }
}
