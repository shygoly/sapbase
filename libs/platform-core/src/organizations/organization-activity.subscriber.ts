import { Injectable, OnModuleInit } from '@nestjs/common'
import { EventBusService } from '../common/events/event-bus.service'
import type { IEventHandler } from '../common/events/i-event-handler'
import {
  BrandConfigUpdatedEvent,
  InvitationAcceptedEvent,
  InvitationCancelledEvent,
  InvitationCreatedEvent,
  MemberAddedEvent,
  MemberRemovedEvent,
  MemberRoleUpdatedEvent,
  OrganizationCreatedEvent,
} from '../organization-context/domain/events'
import { ActivityLogService } from './activity-log.service'
import { CacheService } from '../cache/cache.service'
import { ActivityType } from './organization-activity.entity'

/**
 * 团队事件 → organization_activities。
 * 只记录声明式活动；安全/权限审计仍走 audit_logs。
 */
@Injectable()
export class OrganizationActivitySubscriber implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly activityLog: ActivityLogService,
    private readonly cache: CacheService,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe('OrganizationCreatedEvent', this.onOrganizationCreated)
    this.eventBus.subscribe('MemberAddedEvent', this.onMemberAdded)
    this.eventBus.subscribe('MemberRemovedEvent', this.onMemberRemoved)
    this.eventBus.subscribe('MemberRoleUpdatedEvent', this.onMemberRoleUpdated)
    this.eventBus.subscribe('InvitationCreatedEvent', this.onInvitationCreated)
    this.eventBus.subscribe('InvitationAcceptedEvent', this.onInvitationAccepted)
    this.eventBus.subscribe('InvitationCancelledEvent', this.onInvitationCancelled)
    this.eventBus.subscribe('BrandConfigUpdatedEvent', this.onBrandConfigUpdated)
  }

  private readonly onOrganizationCreated: IEventHandler<OrganizationCreatedEvent> = {
    handle: async (event) => {
      await this.activityLog.record({
        organizationId: event.organizationId,
        userId: event.creatorUserId,
        action: ActivityType.CREATE_ORGANIZATION,
        description: `创建组织 ${event.name}`,
        metadata: { slug: event.slug },
      })
      await this.invalidateUser(event.creatorUserId)
    },
  }

  private readonly onMemberAdded: IEventHandler<MemberAddedEvent> = {
    handle: async (event) => {
      await this.activityLog.record({
        organizationId: event.organizationId,
        userId: event.userId,
        action: ActivityType.INVITE_MEMBER,
        description: `成员加入（${event.role}）`,
        metadata: { role: event.role, invitedById: event.invitedById },
      })
      await this.invalidateUser(event.userId)
    },
  }

  private readonly onMemberRemoved: IEventHandler<MemberRemovedEvent> = {
    handle: async (event) => {
      await this.activityLog.record({
        organizationId: event.organizationId,
        userId: event.userId,
        action: ActivityType.REMOVE_MEMBER,
        description: '成员被移除',
        metadata: { removerId: event.removerId },
      })
      await this.invalidateUser(event.userId)
    },
  }

  private readonly onMemberRoleUpdated: IEventHandler<MemberRoleUpdatedEvent> = {
    handle: async (event) => {
      await this.activityLog.record({
        organizationId: event.organizationId,
        userId: event.userId,
        action: ActivityType.UPDATE_MEMBER_ROLE,
        description: `成员角色 ${event.oldRole} → ${event.newRole}`,
        metadata: {
          oldRole: event.oldRole,
          newRole: event.newRole,
          updatedById: event.updatedById,
        },
      })
    },
  }

  private readonly onInvitationCreated: IEventHandler<InvitationCreatedEvent> = {
    handle: async (event) => {
      await this.activityLog.record({
        organizationId: event.organizationId,
        userId: event.invitedById,
        action: ActivityType.INVITE_MEMBER,
        description: `邀请 ${event.email}`,
        metadata: { email: event.email, role: event.role },
      })
    },
  }

  private readonly onInvitationAccepted: IEventHandler<InvitationAcceptedEvent> = {
    handle: async (event) => {
      await this.activityLog.record({
        organizationId: event.organizationId,
        userId: event.userId,
        action: ActivityType.ACCEPT_INVITATION,
        description: `接受邀请 ${event.email}`,
        metadata: { email: event.email, role: event.role },
      })
      await this.invalidateUser(event.userId)
    },
  }

  private readonly onInvitationCancelled: IEventHandler<InvitationCancelledEvent> = {
    handle: async (event) => {
      await this.activityLog.record({
        organizationId: event.organizationId,
        userId: event.cancelledById,
        action: ActivityType.CANCEL_INVITATION,
        description: `取消邀请 ${event.email}`,
        metadata: { email: event.email },
      })
    },
  }

  private async invalidateUser(userId: string): Promise<void> {
    await this.cache.del(this.cache.generateKey('organizations', 'user', userId))
  }

  private readonly onBrandConfigUpdated: IEventHandler<BrandConfigUpdatedEvent> = {
    handle: async (event) => {
      await this.activityLog.record({
        organizationId: event.organizationId,
        action: ActivityType.UPDATE_BRAND_CONFIG,
        description: '更新品牌配置',
        metadata: { configId: event.configId, updatedFields: event.updatedFields },
      })
    },
  }
}
