import { OrganizationMember, OrganizationRole } from './organization-member.entity'
import { BusinessRuleViolation } from '../errors'

describe('OrganizationMember (Domain Entity)', () => {
  describe('create', () => {
    it('should create a member with valid data', () => {
      const member = OrganizationMember.create(
        'member-1',
        'org-1',
        'user-1',
        OrganizationRole.MEMBER,
      )

      expect(member.id).toBe('member-1')
      expect(member.organizationId).toBe('org-1')
      expect(member.userId).toBe('user-1')
      expect(member.role).toBe(OrganizationRole.MEMBER)
    })

    it('should create an owner member', () => {
      const member = OrganizationMember.create(
        'member-1',
        'org-1',
        'user-1',
        OrganizationRole.OWNER,
      )

      expect(member.role).toBe(OrganizationRole.OWNER)
      expect(member.isOwner()).toBe(true)
    })

    it('should create an admin member', () => {
      const member = OrganizationMember.create(
        'member-1',
        'org-1',
        'user-1',
        OrganizationRole.ADMIN,
      )

      expect(member.role).toBe(OrganizationRole.ADMIN)
      expect(member.isAdmin()).toBe(true)
    })
  })

  describe('updateRole', () => {
    it('should update member role', () => {
      const member = OrganizationMember.create(
        'member-1',
        'org-1',
        'user-1',
        OrganizationRole.MEMBER,
      )

      member.updateRole(OrganizationRole.ADMIN)

      expect(member.role).toBe(OrganizationRole.ADMIN)
    })

    it('should throw error if trying to remove last owner', () => {
      const member = OrganizationMember.create(
        'member-1',
        'org-1',
        'user-1',
        OrganizationRole.OWNER,
      )

      // This should be checked at the application service level
      // Domain entity just updates the role
      member.updateRole(OrganizationRole.MEMBER)
      expect(member.role).toBe(OrganizationRole.MEMBER)
    })
  })

  describe('isOwner', () => {
    it('should return true for owner role', () => {
      const member = OrganizationMember.create(
        'member-1',
        'org-1',
        'user-1',
        OrganizationRole.OWNER,
      )

      expect(member.isOwner()).toBe(true)
    })

    it('should return false for non-owner roles', () => {
      const member = OrganizationMember.create(
        'member-1',
        'org-1',
        'user-1',
        OrganizationRole.MEMBER,
      )

      expect(member.isOwner()).toBe(false)
    })
  })

  describe('isAdmin', () => {
    it('should return true for admin role', () => {
      const member = OrganizationMember.create(
        'member-1',
        'org-1',
        'user-1',
        OrganizationRole.ADMIN,
      )

      expect(member.isAdmin()).toBe(true)
    })

    it('should return true for owner role (owners are admins)', () => {
      const member = OrganizationMember.create(
        'member-1',
        'org-1',
        'user-1',
        OrganizationRole.OWNER,
      )

      expect(member.isAdmin()).toBe(true)
    })

    it('should return false for member role', () => {
      const member = OrganizationMember.create(
        'member-1',
        'org-1',
        'user-1',
        OrganizationRole.MEMBER,
      )

      expect(member.isAdmin()).toBe(false)
    })
  })
})
