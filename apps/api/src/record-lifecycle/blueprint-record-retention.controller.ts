import { Controller, Get, Post, Body } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Auth } from '../common/decorators/auth.decorator'
import { OrganizationId } from '../organizations/decorators/organization-id.decorator'
import { BlueprintRecordRetentionService } from './blueprint-record-retention.service'

@ApiTags('Blueprint Record Retention')
@Controller('blueprints/records/retention')
export class BlueprintRecordRetentionController {
  constructor(private readonly retention: BlueprintRecordRetentionService) {}

  @Get('stats')
  @Auth('system:manage')
  @ApiOperation({ summary: 'blueprint_records 行数/归档数/表大小与分区建议' })
  async stats(@OrganizationId() organizationId: string) {
    const stats = await this.retention.stats(organizationId)
    return {
      ...stats,
      partition: this.retention.recommendPartition(stats),
    }
  }

  @Post('prune')
  @Auth('system:manage')
  @ApiOperation({ summary: '删除超过保留期的已归档记录（active 永不删除）' })
  prune(
    @OrganizationId() organizationId: string,
    @Body()
    body: { olderThanDays?: number; batch?: number; dryRun?: boolean } = {},
  ) {
    return this.retention.prune(organizationId, {
      olderThanDays: body.olderThanDays,
      batch: body.batch,
      dryRun: body.dryRun,
      actor: 'api:retention',
    })
  }
}
