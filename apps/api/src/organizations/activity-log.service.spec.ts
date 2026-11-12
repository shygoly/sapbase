import { ActivityLogService } from '@sap/platform-core/organizations/activity-log.service'
import { OrganizationActivitySubscriber } from '@sap/platform-core/organizations/organization-activity.subscriber'
import { ActivityType } from '@sap/platform-core/organizations/organization-activity.entity'
import { InvitationAcceptedEvent } from '@sap/platform-core/organization-context/domain/events/invitation-accepted.event'
import { MemberAddedEvent } from '@sap/platform-core/organization-context/domain/events/member-added.event'
import { MemberRemovedEvent } from '@sap/platform-core/organization-context/domain/events/member-removed.event'
import { OrganizationCreatedEvent } from '@sap/platform-core/organization-context/domain/events/organization-created.event'
import { OrganizationRole } from '@sap/platform-core/organization-context/domain/entities/organization-member.entity'

describe('ActivityLogService', () => {
  it('写入组织活动', async () => {
    const repository = {
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => ({ id: 'a1', ...row })),
      find: jest.fn(async () => []),
    }
    const service = new ActivityLogService(repository as never)
    const row = await service.record({
      organizationId: 'org-1',
      userId: 'u1',
      action: ActivityType.CREATE_ORGANIZATION,
      description: '创建组织',
    })
    expect(row).toMatchObject({
      organizationId: 'org-1',
      userId: 'u1',
      action: ActivityType.CREATE_ORGANIZATION,
    })
    expect(repository.save).toHaveBeenCalled()
  })
})

describe('OrganizationActivitySubscriber', () => {
  it('把组织/成员/邀请事件映射为活动', async () => {
    const handlers = new Map<string, any>()
    const eventBus = {
      subscribe: jest.fn((name: string, handler: any) => handlers.set(name, handler)),
    }
    const activityLog = { record: jest.fn(async () => undefined) }
    const cache = {
      generateKey: jest.fn((...parts: Array<string | number>) => parts.join(':')),
      del: jest.fn(async () => undefined),
    }
    const subscriber = new OrganizationActivitySubscriber(
      eventBus as never,
      activityLog as never,
      cache as never,
    )
    subscriber.onModuleInit()
    expect(eventBus.subscribe).toHaveBeenCalledTimes(8)

    await handlers.get('OrganizationCreatedEvent').handle(
      new OrganizationCreatedEvent('org-1', 'Acme', 'acme', 'u1', new Date()),
    )
    await handlers.get('MemberAddedEvent').handle(
      new MemberAddedEvent('org-1', 'u2', OrganizationRole.MEMBER, 'u1', new Date()),
    )
    await handlers.get('MemberRemovedEvent').handle(
      new MemberRemovedEvent('org-1', 'u2', 'u1', new Date()),
    )
    await handlers.get('InvitationAcceptedEvent').handle(
      new InvitationAcceptedEvent('i1', 'org-1', 'u2', 'u2@example.com', OrganizationRole.MEMBER, new Date()),
    )

    expect(activityLog.record).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ action: ActivityType.CREATE_ORGANIZATION }),
    )
    expect(activityLog.record).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ action: ActivityType.INVITE_MEMBER }),
    )
    expect(activityLog.record).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ action: ActivityType.REMOVE_MEMBER }),
    )
    expect(activityLog.record).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ action: ActivityType.ACCEPT_INVITATION }),
    )
  })
})
