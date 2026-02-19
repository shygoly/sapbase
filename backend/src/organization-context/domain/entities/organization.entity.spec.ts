import { Organization } from './organization.entity'
import { OrganizationSlug } from '../value-objects/organization-slug.vo'
import { OrganizationMember } from './organization-member.entity'
import { OrganizationRole } from './organization-member.entity'
import { BusinessRuleViolation } from '../errors'

describe('Organization (Domain Entity)', () => {
  describe('create', () => {
    it('should create an organization with valid data', () => {
      const slug = OrganizationSlug.create('test-org')
      const organization = Organization.create('org-1', 'Test Organization', slug)

      expect(organization.id).toBe('org-1')
      expect(organization.name).toBe('Test Organization')
      expect(organization.slug.value).toBe('test-org')
    })

    it('should throw error if name is empty', () => {
      const slug = OrganizationSlug.create('test-org')
      expect(() => {
        Organization.create('org-1', '', slug)
      }).toThrow(BusinessRuleViolation)
    })
  })

  describe('updateName', () => {
    it('should update organization name', () => {
      const slug = OrganizationSlug.create('test-org')
      const organization = Organization.create('org-1', 'Old Name', slug)

      organization.updateName('New Name')

      expect(organization.name).toBe('New Name')
    })

    it('should throw error if new name is empty', () => {
      const slug = OrganizationSlug.create('test-org')
      const organization = Organization.create('org-1', 'Test', slug)

      expect(() => {
        organization.updateName('')
      }).toThrow(BusinessRuleViolation)
    })
  })

  describe('updateSlug', () => {
    it('should update organization slug', () => {
      const slug = OrganizationSlug.create('old-slug')
      const organization = Organization.create('org-1', 'Test', slug)

      const newSlug = OrganizationSlug.create('new-slug')
      organization.updateSlug(newSlug)

      expect(organization.slug.value).toBe('new-slug')
    })
  })

  describe('addMemberToCollection', () => {
    it('should add a member to the collection', () => {
      const slug = OrganizationSlug.create('test-org')
      const organization = Organization.create('org-1', 'Test', slug)

      const member = OrganizationMember.create(
        'member-1',
        'org-1',
        'user-1',
        OrganizationRole.MEMBER,
      )

      organization.addMemberToCollection(member)

      expect(organization.members).toContain(member)
    })

    it('should throw error if member belongs to different organization', () => {
      const slug = OrganizationSlug.create('test-org')
      const organization = Organization.create('org-1', 'Test', slug)

      const member = OrganizationMember.create(
        'member-1',
        'org-2', // Different organization
        'user-1',
        OrganizationRole.MEMBER,
      )

      expect(() => {
        organization.addMemberToCollection(member)
      }).toThrow(BusinessRuleViolation)
    })
  })

  describe('removeMemberFromCollection', () => {
    it('should remove a member from the collection', () => {
      const slug = OrganizationSlug.create('test-org')
      const organization = Organization.create('org-1', 'Test', slug)

      const member = OrganizationMember.create(
        'member-1',
        'org-1',
        'user-1',
        OrganizationRole.MEMBER,
      )

      organization.addMemberToCollection(member)
      expect(organization.members).toContain(member)

      organization.removeMemberFromCollection('member-1')
      expect(organization.members).not.toContain(member)
    })

    it('should not throw error if member does not exist', () => {
      const slug = OrganizationSlug.create('test-org')
      const organization = Organization.create('org-1', 'Test', slug)

      expect(() => {
        organization.removeMemberFromCollection('non-existent')
      }).not.toThrow()
    })
  })

  describe('hasOwner', () => {
    it('should return true if organization has at least one owner', () => {
      const slug = OrganizationSlug.create('test-org')
      const organization = Organization.create('org-1', 'Test', slug)

      const owner = OrganizationMember.create(
        'member-1',
        'org-1',
        'user-1',
        OrganizationRole.OWNER,
      )

      organization.addMemberToCollection(owner)

      expect(organization.hasOwner()).toBe(true)
    })

    it('should return false if organization has no owners', () => {
      const slug = OrganizationSlug.create('test-org')
      const organization = Organization.create('org-1', 'Test', slug)

      const member = OrganizationMember.create(
        'member-1',
        'org-1',
        'user-1',
        OrganizationRole.MEMBER,
      )

      organization.addMemberToCollection(member)

      expect(organization.hasOwner()).toBe(false)
    })
  })
})
