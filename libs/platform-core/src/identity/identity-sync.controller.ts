import { Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { IdentitySyncService } from './identity-sync.service'

@ApiTags('Identity Sync')
@Controller('identity/sync')
export class IdentitySyncController {
  constructor(private readonly sync: IdentitySyncService) {}

  @Post(':providerKey/run')
  @Auth('identity:manage')
  @ApiOperation({ summary: '手动触发身份源同步（新增/更新/离职回收）' })
  run(@OrganizationId() organizationId: string, @Param('providerKey') providerKey: string) {
    return this.sync.run(organizationId, providerKey)
  }

  @Post('runs/:id/confirm')
  @Auth('identity:manage')
  @ApiOperation({ summary: '确认高风险离职差异（pending 批次）' })
  confirm(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user?: { id?: string; userId?: string },
  ) {
    return this.sync.confirm(organizationId, id, user?.id ?? user?.userId ?? 'system')
  }

  @Get('runs')
  @Auth('identity:read')
  @ApiOperation({ summary: '同步批次与差异统计' })
  listRuns(
    @OrganizationId() organizationId: string,
    @Query('providerId') providerId?: string,
  ) {
    return this.sync.listRuns(organizationId, providerId)
  }
}
