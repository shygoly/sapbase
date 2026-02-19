import { Invitation } from './invitation.entity'
import { OrganizationRole } from './organization-member.entity'
import { BusinessRuleViolation } from '../errors'

describe('Invitation (Domain Entity)', () => {
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
  const pastDate = new Date(Date.now() - 1000) // 1 second ago

  describe('create', () => {
    it('should create an invitation with valid data', () => {
      const invitation = Invitation.create(
        'invitation-1',
        'org-1',
        'user@example.com',
        'inviter-1',
        OrganizationRole.MEMBER,
        'token-123',
        futureDate,
      )

      expect(invitation.id).toBe('invitation-1')
      expect(invitation.organizationId).toBe('org-1')
      expect(invitation.email).toBe('user@example.com')
      expect(invitation.role).toBe(OrganizationRole.MEMBER)
      expect(invitation.token).toBe('token-123')
      expect(invitation.expiresAt).toEqual(futureDate)
      expect(invitation.acceptedAt).toBeNull()
    })

    it('should throw error if email is invalid', () => {
      expect(() => {
        Invitation.create(
          'invitation-1',
          'org-1',
          'invalid-email',
          'inviter-1',
          OrganizationRole.MEMBER,
          'token-123',
          futureDate,
        )
      }).toThrow(BusinessRuleViolation)
    })

    it('should throw error if expiration date is in the past', () => {
      expect(() => {
        Invitation.create(
          'invitation-1',
          'org-1',
          'user@example.com',
          'inviter-1',
          OrganizationRole.MEMBER,
          'token-123',
          pastDate,
        )
      }).toThrow(BusinessRuleViolation)
    })
  })

  describe('isExpired', () => {
    it('should return false for non-expired invitation', () => {
      const invitation = Invitation.create(
        'invitation-1',
        'org-1',
        'user@example.com',
        'inviter-1',
        OrganizationRole.MEMBER,
        'token-123',
        futureDate,
      )

      expect(invitation.isExpired()).toBe(false)
    })

    it('should return true for expired invitation', () => {
      const invitation = Invitation.create(
        'invitation-1',
        'org-1',
        'user@example.com',
        'inviter-1',
        OrganizationRole.MEMBER,
        'token-123',
        futureDate,
      )

      // Manually set expiration to past
      ;(invitation as any).expiresAt = pastDate

      expect(invitation.isExpired()).toBe(true)
    })
  })

  describe('isAccepted', () => {
    it('should return false for non-accepted invitation', () => {
      const invitation = Invitation.create(
        'invitation-1',
        'org-1',
        'user@example.com',
        'inviter-1',
        OrganizationRole.MEMBER,
        'token-123',
        futureDate,
      )

      expect(invitation.isAccepted()).toBe(false)
    })

    it('should return true for accepted invitation', () => {
      const invitation = Invitation.create(
        'invitation-1',
        'org-1',
        'user@example.com',
        'inviter-1',
        OrganizationRole.MEMBER,
        'token-123',
        futureDate,
      )

      invitation.accept()

      expect(invitation.isAccepted()).toBe(true)
    })
  })

  describe('accept', () => {
    it('should accept a valid invitation', () => {
      const invitation = Invitation.create(
        'invitation-1',
        'org-1',
        'user@example.com',
        'inviter-1',
        OrganizationRole.MEMBER,
        'token-123',
        futureDate,
      )

      invitation.accept()

      expect(invitation.isAccepted()).toBe(true)
      expect(invitation.acceptedAt).not.toBeNull()
    })

    it('should throw error if invitation is already accepted', () => {
      const invitation = Invitation.create(
        'invitation-1',
        'org-1',
        'user@example.com',
        'inviter-1',
        OrganizationRole.MEMBER,
        'token-123',
        futureDate,
      )

      invitation.accept()

      expect(() => {
        invitation.accept()
      }).toThrow(BusinessRuleViolation)
    })

    it('should throw error if invitation is expired', () => {
      const invitation = Invitation.create(
        'invitation-1',
        'org-1',
        'user@example.com',
        'inviter-1',
        OrganizationRole.MEMBER,
        'token-123',
        futureDate,
      )

      // Manually set expiration to past
      ;(invitation as any).expiresAt = pastDate

      expect(() => {
        invitation.accept()
      }).toThrow(BusinessRuleViolation)
    })
  })
})
