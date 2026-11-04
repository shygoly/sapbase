import { Organization } from './organization.entity'
import { OrganizationMember, OrganizationRole } from './organization-member.entity'
import { BusinessRuleViolation, DomainError } from '../errors'

/**
 * 本文件在 2026-09-25 按**当前实现**重写过（change: restore-green-backend-tests）。
 *
 * 旧规格断言的是另一套 API，写的时候就不成立了（tsc 能看出来，但以前没跑整仓测试）：
 *   · `Organization.create` 是 `(id, name)`（slug 由 name 推导），不是 `(id, name, slug)`
 *   · `organization.slug` 是字符串 getter，不是 `{ value }`
 *   · 空名抛 `DomainError`（旧断言写 `BusinessRuleViolation`，而实现一直抛基类）
 *   · 三个被断言的成员方法**已不存在**，对应用例已删除（登记在 change 的 tasks.md）：
 *     `updateSlug()` / `removeMemberFromCollection()` / `hasOwner()`
 *   · `OrganizationMember.create` 是 `(organizationId, userId, role, invitedById)` 且 id 由仓储分配
 *     —— 需要固定 id 的用例改用 `fromPersistence`
 *
 * 现在的断言对着真实存在的成员权限规则：只有 owner 能移除成员 / 改角色，且最后一个 owner 动不了。
 */
describe('Organization (Domain Entity)', () => {
  const member = (id: string, role: OrganizationRole, userId = `user-${id}`) =>
    OrganizationMember.fromPersistence(id, 'org-1', userId, role, null, new Date())

  const withMembers = (...members: OrganizationMember[]) => {
    const organization = Organization.create('org-1', 'Test')
    for (const each of members) organization.addMemberToCollection(each)
    return organization
  }

  describe('create', () => {
    it('should create an organization with valid data', () => {
      const organization = Organization.create('org-1', 'Test Organization')

      expect(organization.id).toBe('org-1')
      expect(organization.name).toBe('Test Organization')
      // slug 由 name 推导（不再由调用方传入）
      expect(organization.slug).toBe('test-organization')
    })

    it('should throw error if name is empty', () => {
      expect(() => Organization.create('org-1', '')).toThrow(DomainError)
    })
  })

  describe('updateName', () => {
    it('should update organization name', () => {
      const organization = Organization.create('org-1', 'Old Name')

      organization.updateName('New Name')

      expect(organization.name).toBe('New Name')
    })

    it('should throw error if new name is empty', () => {
      const organization = Organization.create('org-1', 'Test')

      expect(() => organization.updateName('')).toThrow(DomainError)
    })
  })

  describe('addMemberToCollection', () => {
    it('should add a member to the collection', () => {
      const organization = Organization.create('org-1', 'Test')
      const owner = member('member-1', OrganizationRole.OWNER)

      organization.addMemberToCollection(owner)

      expect(organization.members).toContain(owner)
    })

    it('should refuse the same user twice', () => {
      const organization = withMembers(member('member-1', OrganizationRole.OWNER, 'user-1'))

      expect(() =>
        organization.addMemberToCollection(member('member-2', OrganizationRole.MEMBER, 'user-1')),
      ).toThrow(BusinessRuleViolation)
    })
  })

  describe('removeMember', () => {
    it('should let an owner remove another member', () => {
      const organization = withMembers(
        member('member-1', OrganizationRole.OWNER, 'user-owner'),
        member('member-2', OrganizationRole.MEMBER, 'user-member'),
      )

      organization.removeMember('user-member', 'user-owner')

      expect(organization.members.map((m) => m.userId)).toEqual(['user-owner'])
    })

    it('should refuse when the remover is not an owner', () => {
      const organization = withMembers(
        member('member-1', OrganizationRole.OWNER, 'user-owner'),
        member('member-2', OrganizationRole.MEMBER, 'user-member'),
      )

      expect(() => organization.removeMember('user-owner', 'user-member')).toThrow(
        BusinessRuleViolation,
      )
    })

    it('should refuse removing the last owner', () => {
      const organization = withMembers(member('member-1', OrganizationRole.OWNER, 'user-owner'))

      expect(() => organization.removeMember('user-owner', 'user-owner')).toThrow(
        'Cannot remove the last owner of an organization',
      )
    })
  })

  describe('updateMemberRole', () => {
    it('should let an owner promote a member', () => {
      const organization = withMembers(
        member('member-1', OrganizationRole.OWNER, 'user-owner'),
        member('member-2', OrganizationRole.MEMBER, 'user-member'),
      )

      organization.updateMemberRole('user-member', OrganizationRole.OWNER, 'user-owner')

      expect(organization.members.find((m) => m.userId === 'user-member')?.role).toBe(
        OrganizationRole.OWNER,
      )
    })

    it('should refuse demoting the last owner', () => {
      const organization = withMembers(member('member-1', OrganizationRole.OWNER, 'user-owner'))

      expect(() =>
        organization.updateMemberRole('user-owner', OrganizationRole.MEMBER, 'user-owner'),
      ).toThrow('Cannot change role of the last owner')
    })
  })

  describe('canBeUpdatedBy', () => {
    it('should be true for owners and false for plain members', () => {
      const organization = withMembers(
        member('member-1', OrganizationRole.OWNER, 'user-owner'),
        member('member-2', OrganizationRole.MEMBER, 'user-member'),
      )

      expect(organization.canBeUpdatedBy('user-owner')).toBe(true)
      expect(organization.canBeUpdatedBy('user-member')).toBe(false)
    })
  })
})
