import { normalizeSelector, selectorMatchesActor } from './assignee-selector'
import { ReviewAssigneeService } from './review-assignee.service'
import { ReviewCheckRegistry, ReviewCheckService } from './review-check'
import { WorkItemsService } from './work-items.service'

describe('assignee selector', () => {
  it('role/user/position/creator 匹配', () => {
    expect(
      selectorMatchesActor({ kind: 'role', role: 'teacher' }, { userId: 'u1', roleKeys: ['teacher'] }),
    ).toBe(true)
    expect(selectorMatchesActor({ kind: 'user', userId: 'u1' }, { userId: 'u1' })).toBe(true)
    expect(
      selectorMatchesActor(
        { kind: 'position', positionKey: 'head_teacher' },
        { userId: 'u1', positionKeys: ['head_teacher'] },
      ),
    ).toBe(true)
    expect(
      selectorMatchesActor({ kind: 'creator' }, { userId: 'u1' }, { creatorId: 'u1' }),
    ).toBe(true)
    expect(
      selectorMatchesActor({ kind: 'creator' }, { userId: 'u2' }, { creatorId: 'u1' }),
    ).toBe(false)
  })

  it('normalizeSelector 拒绝未知/缺字段', () => {
    expect(normalizeSelector({ kind: 'role', role: 'teacher' })).toEqual({
      kind: 'role',
      role: 'teacher',
    })
    expect(normalizeSelector({ kind: 'position', positionKey: 'p', anchor: 'record' })).toEqual({
      kind: 'position',
      positionKey: 'p',
      dimension: undefined,
      anchor: 'record',
    })
    expect(normalizeSelector({ kind: 'nope' })).toBeNull()
  })
})

describe('ReviewAssigneeService', () => {
  it('role 解析 active 绑定并去重', async () => {
    const memberRoles = { find: jest.fn(async () => [{ userId: 'u1' }, { userId: 'u1' }, { userId: 'u2' }]) }
    const memberships = { find: jest.fn() }
    const service = new ReviewAssigneeService(memberRoles as never, memberships as never)
    await expect(service.resolve('org-1', { kind: 'role', role: 'teacher' })).resolves.toEqual([
      'u1',
      'u2',
    ])
  })

  it('position 解析 scope_memberships', async () => {
    const memberRoles = { find: jest.fn() }
    const memberships = { find: jest.fn(async () => [{ subjectId: 'u1' }, { subjectId: 'u2' }]) }
    const service = new ReviewAssigneeService(memberRoles as never, memberships as never)
    await expect(
      service.resolve('org-1', { kind: 'position', positionKey: 'head_teacher' }),
    ).resolves.toEqual(['u1', 'u2'])
    expect(memberships.find).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        positionKey: 'head_teacher',
        subjectType: 'user',
      },
    })
  })
})

describe('ReviewCheckService', () => {
  it('pass/fail/warn 原样返回', async () => {
    const registry = new ReviewCheckRegistry()
    registry.register({ name: 'ok', check: async () => ({ status: 'pass', evidence: {} }) })
    registry.register({ name: 'bad', check: async () => ({ status: 'fail', evidence: {} }) })
    registry.register({ name: 'warn', check: async () => ({ status: 'warn', evidence: {} }) })
    const service = new ReviewCheckService(registry)
    await expect(service.run('ok', {})).resolves.toMatchObject({ status: 'pass' })
    await expect(service.run('bad', {})).resolves.toMatchObject({ status: 'fail' })
    await expect(service.run('warn', {})).resolves.toMatchObject({ status: 'warn' })
  })

  it('未知 provider/provider 异常/超时 → fail-closed', async () => {
    const registry = new ReviewCheckRegistry()
    registry.register({
      name: 'throw',
      check: async () => {
        throw new Error('boom')
      },
    })
    registry.register({ name: 'slow', check: async () => new Promise(() => undefined) as never })
    const service = new ReviewCheckService(registry)
    await expect(service.run('missing', {})).resolves.toMatchObject({ status: 'fail' })
    await expect(service.run('throw', {})).resolves.toMatchObject({
      status: 'fail',
      evidence: expect.objectContaining({ error: 'boom' }),
    })
    await expect(service.run('slow', {}, { timeoutMs: 5 })).resolves.toMatchObject({
      status: 'fail',
      evidence: expect.objectContaining({ timeout: true }),
    })
  }, 2_000)
})

describe('WorkItemsService', () => {
  function repo() {
    const store: any[] = []
    return {
      findOne: jest.fn(async ({ where }: any) =>
        store.find(
          (row) =>
            row.organizationId === where.organizationId &&
            row.sourceType === where.sourceType &&
            row.sourceId === where.sourceId,
        ) ?? null,
      ),
      create: jest.fn((row) => ({ id: 'w1', ...row })),
      save: jest.fn(async (row) => {
        const index = store.findIndex((item) => item.id === row.id)
        if (index >= 0) store[index] = row
        else store.push(row)
        return row
      }),
      update: jest.fn(async () => ({ affected: 1 })),
      find: jest.fn(async () => store),
    }
  }

  it('投影幂等：重复 source 更新同一工作项', async () => {
    const repository = repo()
    const service = new WorkItemsService(repository as never)
    const first = await service.project({
      organizationId: 'org-1',
      sourceType: 'approval',
      sourceId: 'a1',
      title: '审批 A',
    })
    const second = await service.project({
      organizationId: 'org-1',
      sourceType: 'approval',
      sourceId: 'a1',
      title: '审批 A2',
    })
    expect(second.id).toBe(first.id)
    expect(second.title).toBe('审批 A2')
    expect(repository.save).toHaveBeenCalledTimes(2)
  })

  it('close 只关闭 open 工作项', async () => {
    const repository = repo()
    const service = new WorkItemsService(repository as never)
    await expect(service.close('org-1', 'approval', 'a1')).resolves.toBe(true)
    expect(repository.update).toHaveBeenCalledWith(
      { organizationId: 'org-1', sourceType: 'approval', sourceId: 'a1', status: 'open' },
      { status: 'done' },
    )
  })
})
