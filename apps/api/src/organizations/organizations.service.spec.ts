import { BadRequestException, NotFoundException } from '@nestjs/common'
import { OrganizationsService } from '@sap/platform-core/organizations/organizations.service'
import { OrganizationRole } from '@sap/platform-core/organizations/organization-member.entity'

function setup() {
  const organizations = {
    findOne: jest.fn<any, any>(async () => null),
    create: jest.fn((row) => ({ id: 'org-1', ...row })),
    save: jest.fn(async (row) => ({ id: row.id ?? 'org-1', ...row })),
    update: jest.fn(),
  }
  const members = {
    findOne: jest.fn<any, any>(async () => null),
    find: jest.fn<any, any>(async () => []),
    count: jest.fn(async () => 1),
    create: jest.fn((row) => ({ id: 'member-1', ...row })),
    save: jest.fn(async (row) => row),
    delete: jest.fn(async () => ({ affected: 1 })),
  }
  const users = { findOne: jest.fn(async () => ({ id: 'u1' })) }
  const cache = {
    generateKey: jest.fn((...parts: Array<string | number>) => parts.join(':')),
    get: jest.fn<any, any>(async () => undefined),
    set: jest.fn(async () => undefined),
    del: jest.fn(async () => undefined),
  }
  const service = new OrganizationsService(
    organizations as never,
    members as never,
    users as never,
    cache as never,
  )
  return { service, organizations, members, cache }
}

describe('OrganizationsService', () => {
  it('创建组织：生成 slug 并把创建者设为 Owner', async () => {
    const { service, organizations, members } = setup()
    const org = await service.create('Acme Corp', 'u1')
    expect(org).toMatchObject({ name: 'Acme Corp', slug: 'acme-corp' })
    expect(organizations.save).toHaveBeenCalled()
    expect(members.save).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'u1',
        role: OrganizationRole.OWNER,
      }),
    )
  })

  it('findOne：非成员 → 404，不泄露组织', async () => {
    const { service } = setup()
    await expect(service.findOne('org-1', 'u1')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('findAll：缓存命中不查成员表', async () => {
    const { service, cache, members } = setup()
    const org = { id: 'org-1', name: 'Acme' }
    cache.get.mockResolvedValueOnce([org])
    await expect(service.findAll('u1')).resolves.toEqual([org])
    expect(members.find).not.toHaveBeenCalled()
  })

  it('removeMember：最后一个 Owner 不可移除', async () => {
    const { service, members } = setup()
    members.findOne
      .mockResolvedValueOnce({ organizationId: 'org-1', userId: 'owner-1', role: OrganizationRole.OWNER })
      .mockResolvedValueOnce({ organizationId: 'org-1', userId: 'owner-1', role: OrganizationRole.OWNER })
    members.count.mockResolvedValueOnce(1)
    await expect(service.removeMember('org-1', 'owner-1', 'owner-1')).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('updateMemberRole：最后一个 Owner 不可降级', async () => {
    const { service, members } = setup()
    members.findOne
      .mockResolvedValueOnce({ organizationId: 'org-1', userId: 'owner-1', role: OrganizationRole.OWNER })
      .mockResolvedValueOnce({ organizationId: 'org-1', userId: 'owner-1', role: OrganizationRole.OWNER })
    members.count.mockResolvedValueOnce(1)
    await expect(
      service.updateMemberRole('org-1', 'owner-1', OrganizationRole.MEMBER, 'owner-1'),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('getMembers：先校验成员关系', async () => {
    const { service, members } = setup()
    members.findOne.mockResolvedValueOnce({
      organizationId: 'org-1',
      userId: 'u1',
      role: OrganizationRole.MEMBER,
      organization: { id: 'org-1' },
    })
    members.find.mockResolvedValueOnce([{ userId: 'u2' }])
    await expect(service.getMembers('org-1', 'u1')).resolves.toEqual([{ userId: 'u2' }])
  })
})
