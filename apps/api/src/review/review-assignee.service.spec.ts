import { ReviewAssigneeService } from './review-assignee.service'

function setup(options: {
  roleRows?: any[]
  membershipRows?: any[]
  binding?: any
} = {}) {
  const memberRoles = { find: jest.fn(async () => options.roleRows ?? []) }
  const memberships = { find: jest.fn(async () => options.membershipRows ?? []) }
  const bindings = { findOne: jest.fn(async () => options.binding ?? null) }
  return {
    service: new ReviewAssigneeService(
      memberRoles as never,
      memberships as never,
      bindings as never,
    ),
    memberRoles,
    memberships,
    bindings,
  }
}

describe('ReviewAssigneeService', () => {
  it('role/user/creator 去重解析', async () => {
    const { service } = setup({
      roleRows: [{ userId: 'u1' }, { userId: 'u1' }, { userId: 'u2' }],
    })
    await expect(
      service.resolve('org-1', { kind: 'role', role: 'teacher' }),
    ).resolves.toEqual(['u1', 'u2'])
    await expect(service.resolve('org-1', { kind: 'user', userId: 'u9' })).resolves.toEqual(['u9'])
    await expect(
      service.resolve('org-1', { kind: 'creator' }, { creatorId: 'u3' }),
    ).resolves.toEqual(['u3'])
    await expect(service.resolve('org-1', { kind: 'creator' })).resolves.toEqual([])
  })

  it('position + anchor=record：按绑定字段找节点，再查节点岗位成员', async () => {
    const { service, bindings, memberships } = setup({
      binding: { field: 'classId', dimensionKey: 'class' },
      membershipRows: [
        { subjectId: 'teacher-1', validFrom: null, validTo: null },
        { subjectId: 'teacher-2', validFrom: new Date(Date.now() + 60_000), validTo: null },
      ],
    })
    await expect(
      service.resolve(
        'org-1',
        { kind: 'position', positionKey: 'head_teacher', dimension: 'class', anchor: 'record' },
        { resourceKey: 'student', data: { classId: 'node-1' } },
      ),
    ).resolves.toEqual(['teacher-1'])
    expect(bindings.findOne).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', resourceKey: 'student', dimensionKey: 'class' },
    })
    expect(memberships.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ nodeId: expect.anything(), positionKey: 'head_teacher' }),
      }),
    )
  })

  it('无绑定/无节点/无成员 → 空集 + 告警（不自动通过）', async () => {
    const noBinding = setup({ membershipRows: [] })
    await expect(
      noBinding.service.resolveWithAlert(
        'org-1',
        { kind: 'position', positionKey: 'head_teacher', anchor: 'record' },
        { resourceKey: 'student', data: { classId: 'node-1' } },
      ),
    ).resolves.toMatchObject({ assignees: [], warning: expect.stringContaining('解析为空') })

    const noNode = setup({ binding: { field: 'classId' }, membershipRows: [] })
    await expect(
      noNode.service.resolve(
        'org-1',
        { kind: 'position', positionKey: 'head_teacher', anchor: 'record' },
        { resourceKey: 'student', data: {} },
      ),
    ).resolves.toEqual([])

    const noMember = setup({ binding: { field: 'classId' }, membershipRows: [] })
    await expect(
      noMember.service.resolve(
        'org-1',
        { kind: 'position', positionKey: 'head_teacher', anchor: 'record' },
        { resourceKey: 'student', data: { classId: ['node-1', 'node-2'] } },
      ),
    ).resolves.toEqual([])
  })
})
