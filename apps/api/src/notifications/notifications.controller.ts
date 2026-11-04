import {
  Controller,
  Get,
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
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @ApiOperation({ summary: '当前用户的通知（默认未读；?all=true 含已读）' })
  async list(
    @Query('all') all?: string,
    @CurrentUser() user?: NotificationUser,
  ) {
    const userId = user?.id ?? user?.userId ?? ''
    const organizationId = user?.organizationId
    if (!userId || !organizationId) return { notifications: [] }
    const notifications = await this.notifications.listForUser(
      userId,
      organizationId,
      all === 'true',
    )
    return { notifications }
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
