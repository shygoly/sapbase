import { Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
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
