import { Controller, Get, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '@sap/platform-core/common/decorators/auth.decorator'
import { OrganizationId } from '@sap/platform-core/organizations/decorators/organization-id.decorator'
import { OperationsDashboardService } from './operations-dashboard.service'

@ApiTags('Operations Dashboard')
@Controller('operations')
export class OperationsDashboardController {
  constructor(private readonly dashboard: OperationsDashboardService) {}

  @Get('dashboard')
  @Auth()
  @ApiOperation({ summary: '安装与 Agent 运行的 audit/SLO/成本/失败看板' })
  summary(
    @OrganizationId() organizationId: string,
    @Query('hours') hours?: string,
  ) {
    return this.dashboard.getDashboard(
      organizationId,
      hours === undefined ? 24 : Number(hours),
    )
  }
}
