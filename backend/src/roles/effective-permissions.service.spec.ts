import { EffectivePermissionsService } from './effective-permissions.service'
import { RolesService } from './roles.service'

function build(findByName: RolesService['findByName']) {
  return new EffectivePermissionsService({ findByName } as never)
}

describe('EffectivePermissionsService', () => {
  it('并集：角色权限 A + 直授 B → 同时含 A 与 B，且角色在前', async () => {
    const findByName = jest.fn(async () => ({
      permissions: ['role:read'],
    })) as unknown as RolesService['findByName']
    const service = build(findByName)

    await expect(
      service.resolve({
        role: 'clerk',
        directPermissions: ['direct:write'],
        organizationId: 'org-1',
      }),
    ).resolves.toEqual(['role:read', 'direct:write'])
    expect(findByName).toHaveBeenCalledWith('clerk', 'org-1')
  })

  it('去重：同一权限点同时在角色与直授里只出现一次（保留角色侧的位置）', async () => {
    const service = build(
      jest.fn(async () => ({
        permissions: ['shared:perm', 'role:only'],
      })) as unknown as RolesService['findByName'],
    )

    await expect(
      service.resolve({
        role: 'clerk',
        directPermissions: ['shared:perm', 'direct:only'],
        organizationId: 'org-1',
      }),
    ).resolves.toEqual(['shared:perm', 'role:only', 'direct:only'])
  })

  it('其它组织的同名角色不生效：findByName 在选中组织内返回 null 时只留直授', async () => {
    const findByName = jest.fn(async () => null) as unknown as RolesService['findByName']
    const service = build(findByName)

    await expect(
      service.resolve({
        role: 'clerk',
        directPermissions: ['direct:keep'],
        organizationId: 'org-selected',
      }),
    ).resolves.toEqual(['direct:keep'])
    expect(findByName).toHaveBeenCalledWith('clerk', 'org-selected')
    expect(findByName).toHaveBeenCalledTimes(1)
  })

  it('停用角色不生效：findByName 只认 active，返回 null 时直授保留', async () => {
    const findByName = jest.fn(async () => null) as unknown as RolesService['findByName']
    const service = build(findByName)

    await expect(
      service.resolve({
        role: 'clerk',
        directPermissions: ['direct:keep'],
        organizationId: 'org-1',
      }),
    ).resolves.toEqual(['direct:keep'])
  })

  it('角色不存在 → 只留直授', async () => {
    const service = build(jest.fn(async () => null) as unknown as RolesService['findByName'])

    await expect(
      service.resolve({
        role: 'ghost',
        directPermissions: ['direct:keep'],
        organizationId: 'org-1',
      }),
    ).resolves.toEqual(['direct:keep'])
  })

  it('organizationId 缺失 → 只留直授，且不查角色', async () => {
    const findByName = jest.fn(async () => ({
      permissions: ['should-not-appear'],
    })) as unknown as RolesService['findByName']
    const service = build(findByName)

    await expect(
      service.resolve({
        role: 'clerk',
        directPermissions: ['direct:keep'],
      }),
    ).resolves.toEqual(['direct:keep'])
    expect(findByName).not.toHaveBeenCalled()
  })

  it('直授在任何分支下都必须保留（空角色权限也不覆盖）', async () => {
    const service = build(
      jest.fn(async () => ({ permissions: [] })) as unknown as RolesService['findByName'],
    )

    await expect(
      service.resolve({
        role: 'clerk',
        directPermissions: ['direct:keep', 'direct:also'],
        organizationId: 'org-1',
      }),
    ).resolves.toEqual(['direct:keep', 'direct:also'])
  })
})
