import { RolesService } from './roles.service'

describe('RolesService.findByName', () => {
  it('只按 name + organizationId + status=active 查，命中则返回该行', async () => {
    const role = { id: 'r1', name: 'clerk', organizationId: 'org-1', status: 'active' }
    const findOne = jest.fn(async () => role)
    const service = new RolesService({ findOne } as never)

    await expect(service.findByName('clerk', 'org-1')).resolves.toEqual(role)
    expect(findOne).toHaveBeenCalledWith({
      where: { name: 'clerk', organizationId: 'org-1', status: 'active' },
    })
  })

  it('组织内没有同名 active 角色 → 返回 null（不是抛错）', async () => {
    const findOne = jest.fn(async () => null)
    const service = new RolesService({ findOne } as never)

    await expect(service.findByName('ghost', 'org-1')).resolves.toBeNull()
  })

  it('签名强制带 organizationId：查询条件必须含组织，没有按名字全局查的入口', async () => {
    const findOne = jest.fn().mockResolvedValue(null)
    const service = new RolesService({ findOne } as never)

    await service.findByName('clerk', 'org-selected')

    expect(findOne).toHaveBeenCalledWith({
      where: {
        name: 'clerk',
        organizationId: 'org-selected',
        status: 'active',
      },
    })
  })
})
