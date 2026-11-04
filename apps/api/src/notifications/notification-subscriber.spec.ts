import { EventBusService } from '../common/events/event-bus.service'
import { NotificationSubscriber } from './notification-subscriber'

describe('NotificationSubscriber', () => {
  it('注册三个 topic；缺 eventId 不写通知', async () => {
    const eventBus = new EventBusService()
    const sendToUser = jest.fn()
    const query = jest.fn()
    const subscriber = new NotificationSubscriber(
      eventBus,
      { sendToUser } as never,
      { query } as never,
    )
    subscriber.onModuleInit()
    expect(eventBus.listSubscribers('blueprint.record.approval.pending')).toHaveLength(1)
    expect(eventBus.listSubscribers('blueprint.record.transitioned')).toHaveLength(1)
    expect(eventBus.listSubscribers('blueprint.import.completed')).toHaveLength(1)

    await subscriber.handle({
      topic: 'blueprint.record.approval.pending',
      payload: { role: 'sales-manager' },
      organizationId: 'org-1',
    })
    expect(sendToUser).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
  })

  it('approval.pending：只通知 users.role 匹配的成员', async () => {
    const sendToUser = jest.fn()
    const query = jest.fn(async () => [{ id: 'u-manager' }])
    const subscriber = new NotificationSubscriber(
      new EventBusService(),
      { sendToUser } as never,
      { query } as never,
    )
    await subscriber.handle({
      topic: 'blueprint.record.approval.pending',
      payload: {
        role: 'sales-manager',
        entity: 'SalesOrder',
        recordId: 'r1',
        ruleId: 'so-high-value',
        stepIndex: 0,
      },
      eventId: 'evt-1',
      organizationId: 'org-1',
    })
    expect(query).toHaveBeenCalledWith(expect.stringContaining('u.role'), [
      'org-1',
      'sales-manager',
    ])
    expect(sendToUser).toHaveBeenCalledTimes(1)
    expect(sendToUser).toHaveBeenCalledWith(
      'u-manager',
      expect.objectContaining({ title: '有一张单等你批', organizationId: 'org-1' }),
      'evt-1',
    )
  })

  it('负例：角色下没有用户 → 不写通知', async () => {
    const sendToUser = jest.fn()
    const subscriber = new NotificationSubscriber(
      new EventBusService(),
      { sendToUser } as never,
      { query: async () => [] } as never,
    )
    await subscriber.handle({
      topic: 'blueprint.record.approval.pending',
      payload: { role: 'gm' },
      eventId: 'evt-2',
      organizationId: 'org-1',
    })
    expect(sendToUser).not.toHaveBeenCalled()
  })

  it('transitioned：组织成员都能收到 X→Y', async () => {
    const sendToUser = jest.fn()
    const subscriber = new NotificationSubscriber(
      new EventBusService(),
      { sendToUser } as never,
      { query: async () => [{ userId: 'u-1' }, { userId: 'u-2' }] } as never,
    )
    await subscriber.handle({
      topic: 'blueprint.record.transitioned',
      payload: { from: 'draft', to: 'confirmed', entity: 'SalesOrder', recordId: 'r1' },
      eventId: 'evt-3',
      organizationId: 'org-1',
    })
    expect(sendToUser).toHaveBeenCalledTimes(2)
    expect(sendToUser.mock.calls[0][1].title).toBe('状态从 draft → confirmed')
  })

  it('import.completed：failed>0 用 error；actor 非 uuid 不写', async () => {
    const sendToUser = jest.fn()
    const subscriber = new NotificationSubscriber(
      new EventBusService(),
      { sendToUser } as never,
      { query: jest.fn() } as never,
    )
    await subscriber.handle({
      topic: 'blueprint.import.completed',
      payload: { actor: 'semantic-runtime', imported: 1, failed: 2 },
      eventId: 'evt-4',
      organizationId: 'org-1',
    })
    expect(sendToUser).not.toHaveBeenCalled()

    await subscriber.handle({
      topic: 'blueprint.import.completed',
      payload: {
        actor: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        imported: 1,
        failed: 2,
      },
      eventId: 'evt-5',
      organizationId: 'org-1',
    })
    expect(sendToUser).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      expect.objectContaining({ type: 'error' }),
      'evt-5',
    )
  })
})
