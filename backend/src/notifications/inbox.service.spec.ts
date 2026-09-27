import { InboxService } from './inbox.service'
import { BlueprintApproval } from '../semantic-runtime/blueprint-approval.entity'

describe('InboxService', () => {
  it('缺角色或缺租户 → 空列表，不查全表', async () => {
    const find = jest.fn()
    const service = new InboxService({
      getRepository: () => ({ find }),
    } as never)
    expect(await service.listForCaller({})).toEqual([])
    expect(await service.listForCaller({ role: 'sales-manager' })).toEqual([])
    expect(await service.listForCaller({ organizationId: 'org-1' })).toEqual([])
    expect(find).not.toHaveBeenCalled()
  })

  it('按调用者 role + 租户查 pending，since 升序再 id', async () => {
    const find = jest.fn(async () => [
      {
        id: 'a1',
        blueprintId: 'auto-parts',
        entity: 'SalesOrder',
        recordId: 'r1',
        ruleId: 'so-high-value',
        stepIndex: 0,
        role: 'sales-manager',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ])
    const service = new InboxService({
      getRepository: (entity: unknown) => {
        expect(entity).toBe(BlueprintApproval)
        return { find }
      },
    } as never)
    const items = await service.listForCaller({
      role: 'sales-manager',
      organizationId: 'org-1',
    })
    expect(find).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', status: 'pending', role: 'sales-manager' },
      order: { createdAt: 'ASC', id: 'ASC' },
    })
    expect(items).toEqual([
      {
        approvalId: 'a1',
        blueprintId: 'auto-parts',
        entity: 'SalesOrder',
        recordId: 'r1',
        ruleId: 'so-high-value',
        stepIndex: 0,
        role: 'sales-manager',
        since: '2026-01-01T00:00:00.000Z',
      },
    ])
  })
})
