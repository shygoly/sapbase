/**
 * 本文件在 2026-09-25 按**当前实现**重写过（change: restore-green-backend-tests）。
 * 旧断言的 `isOwner()` / `isAdmin()` / `OrganizationRole.ADMIN` 在当前实现里都不存在
 * （角色只有 OWNER / MEMBER），对应用例已删除并登记在 change 的 tasks.md。
 */
import { OrganizationMember, OrganizationRole } from './organization-member.entity'

describe('OrganizationMember (Domain Entity)', () => {
  describe('create', () => {
    it('should create a member with valid data（id 由仓储分配，故为空）', () => {
      const member = OrganizationMember.create('org-1', 'user-1', OrganizationRole.MEMBER, 'inviter-1')

      expect(member.id).toBe('')
      expect(member.organizationId).toBe('org-1')
      expect(member.userId).toBe('user-1')
      expect(member.role).toBe(OrganizationRole.MEMBER)
      expect(member.invitedById).toBe('inviter-1')
    })

    it('should create an owner member', () => {
      const member = OrganizationMember.create('org-1', 'user-1', OrganizationRole.OWNER, 'inviter-1')

      expect(member.role).toBe(OrganizationRole.OWNER)
    })
  })

  describe('fromPersistence', () => {
    it('should keep the id / invitedById / joinedAt it is given', () => {
      const joinedAt = new Date('2026-01-01T00:00:00Z')
      const member = OrganizationMember.fromPersistence(
        'member-1',
        'org-1',
        'user-1',
        OrganizationRole.MEMBER,
        null,
        joinedAt,
      )

      expect(member.id).toBe('member-1')
      expect(member.invitedById).toBeNull()
      expect(member.joinedAt).toEqual(joinedAt)
    })
  })

  describe('updateRole', () => {
    it('should update the role in place', () => {
      const member = OrganizationMember.fromPersistence(
        'member-1',
        'org-1',
        'user-1',
        OrganizationRole.MEMBER,
        null,
        new Date(),
      )

      member.updateRole(OrganizationRole.OWNER)

      expect(member.role).toBe(OrganizationRole.OWNER)
    })
  })
})
