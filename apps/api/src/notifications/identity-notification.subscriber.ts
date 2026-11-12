import { Injectable, OnModuleInit } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { EventBusService } from '@sap/platform-core/common/events/event-bus.service'
import type { IEventHandler } from '@sap/platform-core/common/events/i-event-handler'
import { AuthLoginAnomalyEvent } from '@sap/platform-core/common/events/auth-login-anomaly.event'
import { NotificationService } from '../websocket/services/notification.service'
import { usersWithRole } from './role-users'

/**
 * 新设备/新 IP 登录：通知本人 + 组织管理员。
 * 通知落库走 notification-center；WS 在线推送由 NotificationService 负责。
 */
@Injectable()
export class IdentityNotificationSubscriber
  implements OnModuleInit, IEventHandler<AuthLoginAnomalyEvent>
{
  constructor(
    private readonly eventBus: EventBusService,
    private readonly notifications: NotificationService,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe('AuthLoginAnomalyEvent', this)
  }

  async handle(event: AuthLoginAnomalyEvent): Promise<void> {
    const kinds = [
      event.newDevice ? '新设备' : null,
      event.newIp ? '新 IP' : null,
    ].filter(Boolean)
    if (kinds.length === 0) return
    const message = `${event.email} 通过${kinds.join(' / ')}登录${
      event.ip ? `（IP ${event.ip}）` : ''
    }`
    if (event.userId) {
      await this.notifications.sendToUser(
        event.userId,
        {
          organizationId: event.organizationId,
          type: 'warning',
          title: '新设备登录提醒',
          message,
          category: 'security',
          priority: 'high',
          data: {
            loginEventId: event.loginEventId,
            newDevice: event.newDevice,
            newIp: event.newIp,
            ip: event.ip,
            userAgent: event.userAgent,
          },
        },
        `auth-login-anomaly:${event.loginEventId}:user`,
      )
    }
    const admins = await usersWithRole(this.dataSource, event.organizationId, 'Admin')
    for (const adminId of admins) {
      if (adminId === event.userId) continue
      await this.notifications.sendToUser(
        adminId,
        {
          organizationId: event.organizationId,
          type: 'warning',
          title: '成员异常登录',
          message,
          category: 'security',
          priority: 'high',
          data: {
            loginEventId: event.loginEventId,
            userId: event.userId,
            email: event.email,
            newDevice: event.newDevice,
            newIp: event.newIp,
            ip: event.ip,
          },
        },
        `auth-login-anomaly:${event.loginEventId}:admin:${adminId}`,
      )
    }
  }
}
