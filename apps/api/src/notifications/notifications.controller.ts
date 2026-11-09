import {
  Body,
  Controller,
  Get,
  Optional,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { NotificationService } from '../websocket/services/notification.service'
import { NotificationPreferencesService } from './notification-preferences.service'

type NotificationUser = {
  id?: string
  userId?: string
  organizationId?: string
}

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationService,
    @Optional() private readonly preferences?: NotificationPreferencesService,
  ) {}

  @Get()
  @ApiOperation({ summary: '当前用户的通知（默认未读；?all=true 含已读）' })
  async list(
    @Query('all') all?: string,
    @CurrentUser() user?: NotificationUser,
    @Query('category') category?: string,
    @Query('priority') priority?: string,
    @Query('includeExpired') includeExpired?: string,
  ) {
    const userId = user?.id ?? user?.userId ?? ''
    const organizationId = user?.organizationId
    if (!userId || !organizationId) return { notifications: [] }
    const notifications = await this.notifications.listForUser(
      userId,
      organizationId,
      all === 'true',
      { category, priority, includeExpired: includeExpired === 'true' },
    )
    return { notifications }
  }

  @Get('unread-count')
  @ApiOperation({ summary: '当前用户未读通知数量' })
  async unreadCount(@CurrentUser() user?: NotificationUser) {
    const userId = user?.id ?? user?.userId ?? ''
    const organizationId = user?.organizationId
    if (!userId || !organizationId) return { count: 0 }
    return { count: await this.notifications.unreadCount(userId, organizationId) }
  }

  @Post('read-all')
  @ApiOperation({ summary: '全部标记已读' })
  async markAllRead(@CurrentUser() user?: NotificationUser) {
    const userId = user?.id ?? user?.userId ?? ''
    const organizationId = user?.organizationId
    if (!userId || !organizationId) return { updated: 0 }
    return { updated: await this.notifications.markAllRead(userId, organizationId) }
  }

  @Get('preferences')
  @ApiOperation({ summary: '通知偏好（分类/渠道/免打扰）' })
  async listPreferences(@CurrentUser() user?: NotificationUser) {
    const userId = user?.id ?? user?.userId ?? ''
    const organizationId = user?.organizationId
    if (!userId || !organizationId) return []
    return this.preferences?.list(organizationId, userId) ?? []
  }

  @Post('preferences/:category')
  @ApiOperation({ summary: '更新通知偏好' })
  async updatePreference(
    @Param('category') category: string,
    @Body() body: { inApp?: boolean; email?: boolean; push?: boolean; mutedUntil?: string | null },
    @CurrentUser() user?: NotificationUser,
  ) {
    const userId = user?.id ?? user?.userId ?? ''
    const organizationId = user?.organizationId
    if (!userId || !organizationId) throw new NotFoundException('用户上下文缺失')
    if (!this.preferences) throw new NotFoundException('通知偏好未启用')
    return this.preferences.upsert(organizationId, userId, category as never, {
      ...body,
      mutedUntil:
        body.mutedUntil === undefined
          ? undefined
          : body.mutedUntil === null
            ? null
            : new Date(body.mutedUntil),
    })
  }

  @Post(':id/read')
  @ApiOperation({ summary: '已读持久' })
  async markRead(@Param('id') id: string, @CurrentUser() user?: NotificationUser) {
    const userId = user?.id ?? user?.userId ?? ''
    const organizationId = user?.organizationId
    if (!userId || !organizationId) {
      throw new NotFoundException('通知不存在')
    }
    const updated = await this.notifications.markAsRead(userId, id, organizationId)
    if (!updated) {
      throw new NotFoundException('通知不存在')
    }
    return { id, read: true }
  }
}
