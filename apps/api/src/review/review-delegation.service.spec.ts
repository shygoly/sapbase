import { ReviewDelegationService } from './review-delegation.service'

function setup(rows: any[] = []) {
  const store = [...rows]
  const repository = {
    findOne: jest.fn(async ({ where }: any) =>
      store.find(
        (row) =>
          row.organizationId === where.organizationId &&
          (!where.approvalId || row.approvalId === where.approvalId) &&
          (!where.toUserId || row.toUserId === where.toUserId) &&
          (!where.status || row.status === where.status) &&
          (!where.id || row.id === where.id),
      ) ?? null,
    ),
    find: jest.fn(async ({ where }: any) =>
      store.filter(
        (row) =>
          row.organizationId === where.organizationId &&
          (!where.approvalId || row.approvalId === where.approvalId),
      ),
    ),
    create: jest.fn((row) => ({ id: 'del-1', ...row })),
    save: jest.fn(async (row) => {
      const index = store.findIndex((item) => item.id === row.id)
      if (index >= 0) store[index] = row
      else store.push(row)
      return row
    }),
  }
  return { service: new ReviewDelegationService(repository as never), repository }
}

describe('ReviewDelegationService', () => {
  it('拒绝委托给自己/重复/时间倒置', async () => {
    const { service } = setup()
    await expect(
      service.create('org-1', 'ap-1', 'u1', 'u1'),
    ).rejects.toThrow(/自己/)
    await expect(
      service.create('org-1', 'ap-1', 'u1', 'u2', {
        validFrom: new Date('2026-02-02'),
        validTo: new Date('2026-02-01'),
      }),
    ).rejects.toThrow(/validFrom/)
  })

  it('有效期内可代决定，撤销后失效', async () => {
    const { service } = setup()
    const created = await service.create('org-1', 'ap-1', 'u1', 'u2', {
      validFrom: new Date(Date.now() - 60_000),
      validTo: new Date(Date.now() + 60_000),
    })
    await expect(
      service.findActive('org-1', 'ap-1', 'u2'),
    ).resolves.toMatchObject({ fromUserId: 'u1', toUserId: 'u2' })
    await service.revoke('org-1', created.id)
    await expect(service.findActive('org-1', 'ap-1', 'u2')).resolves.toBeNull()
  })
})
