import { InboxController } from './inbox.controller'

describe('InboxController', () => {
  it('把当前用户交给 InboxService；缺角色由服务返回空', async () => {
    const inbox = {
      listForCaller: jest.fn(async (user?: { role?: string }) =>
        user?.role ? [{ approvalId: 'a1' }] : [],
      ),
    }
    const controller = new InboxController(inbox as never)
    expect(await controller.list({})).toEqual([])
    expect(await controller.list({ role: 'sales-manager', organizationId: 'org-1' })).toEqual([
      { approvalId: 'a1' },
    ])
  })
})
