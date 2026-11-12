import { Injectable, OnModuleInit } from '@nestjs/common'
import { EventBusService } from '../common/events/event-bus.service'
import type { IEventHandler } from '../common/events/i-event-handler'
import { UserSecurityChangedEvent } from '../common/events/user-security-changed.event'
import { AuthSessionsService } from './auth-sessions.service'

/**
 * 密码修改/角色变更/账号停用/删除 → 吊销全部会话。
 * 会话吊销后，旧 JWT 的下一次请求会被 JwtStrategy 拒绝。
 */
@Injectable()
export class IdentitySecuritySubscriber
  implements OnModuleInit, IEventHandler<UserSecurityChangedEvent>
{
  constructor(
    private readonly eventBus: EventBusService,
    private readonly sessions: AuthSessionsService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe('UserSecurityChangedEvent', this)
  }

  async handle(event: UserSecurityChangedEvent): Promise<void> {
    await this.sessions.revokeAllForUser(event.userId, event.reason)
  }
}
