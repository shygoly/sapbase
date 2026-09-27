import { Controller, ForbiddenException, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { OutboxService } from './outbox.service'
import type { OutboxEventStatus } from './outbox-event.entity'

type OutboxUser = {
  organizationId?: string
}

@ApiTags('Outbox')
@Controller('outbox')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OutboxController {
  constructor(private readonly outbox: OutboxService) {}

  @Get('events')
  @ApiOperation({ summary: '查 outbox 事件（含 attempts / lastError / deliveredAt）' })
  async list(
    @Query('status') status?: OutboxEventStatus,
    @Query('organizationId') organizationId?: string,
    @CurrentUser() user?: OutboxUser,
  ) {
    const orgId = this.resolveOrg(organizationId, user)
    const events = await this.outbox.listEvents({ organizationId: orgId, status })
    return { events }
  }

  @Post('events/:id/redeliver')
  @ApiOperation({ summary: '手动重投：status=pending，attempts 保留' })
  async redeliver(
    @Param('id') id: string,
    @Query('organizationId') organizationId?: string,
    @CurrentUser() user?: OutboxUser,
  ) {
    return this.outbox.redeliver(id, this.resolveOrg(organizationId, user))
  }

  private resolveOrg(queryOrg: string | undefined, user?: OutboxUser): string {
    const fromUser = user?.organizationId
    if (queryOrg && fromUser && queryOrg !== fromUser) {
      throw new ForbiddenException('租户不匹配')
    }
    return queryOrg || fromUser || ''
  }
}
