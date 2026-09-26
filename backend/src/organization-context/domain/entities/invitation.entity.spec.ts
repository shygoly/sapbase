/**
 * 本文件在 2026-09-25 按**当前实现**重写过（change: restore-green-backend-tests）。
 * 旧断言的 `acceptedAt` / `isAccepted()` 与 7 参 create（自带 id 与 expiresAt）在当前实现里不存在；
 * 现在的模型是"状态机 + 仓储分配 id + 按天数算过期"，对应用例已删除并登记在 tasks.md。
 */
import { Invitation, InvitationStatus } from './invitation.entity'
import { OrganizationRole } from './organization-member.entity'
import { BusinessRuleViolation, DomainError } from '../errors'

describe('Invitation (Domain Entity)', () => {
  const create = (overrides: { email?: string; expiresInDays?: number } = {}) =>
    Invitation.create(
      'org-1',
      overrides.email ?? 'user@example.com',
      OrganizationRole.MEMBER,
      'inviter-1',
      'token-123',
      overrides.expiresInDays ?? 7,
    )

  describe('create', () => {
    it('should create a pending invitation', () => {
      const invitation = create()

      expect(invitation.id).toBe('') // id 由仓储分配
      expect(invitation.organizationId).toBe('org-1')
      expect(invitation.email).toBe('user@example.com')
      expect(invitation.role).toBe(OrganizationRole.MEMBER)
      expect(invitation.token).toBe('token-123')
      expect(invitation.status).toBe(InvitationStatus.PENDING)
      expect(invitation.isPending()).toBe(true)
    })

    it('should normalize the email (lowercase + trim)', () => {
      expect(create({ email: '  User@Example.COM  ' }).email).toBe('user@example.com')
    })

    it('should compute expiresAt from expiresInDays', () => {
      const invitation = create({ expiresInDays: 3 })
      const days = (invitation.expiresAt!.getTime() - Date.now()) / (24 * 60 * 60 * 1000)

      expect(days).toBeGreaterThan(2.9)
      expect(days).toBeLessThan(3.1)
    })

    it('should throw error if email is invalid', () => {
      expect(() => create({ email: 'invalid-email' })).toThrow(DomainError)
    })
  })

  describe('accept', () => {
    it('should accept when the email matches', () => {
      const invitation = create()

      invitation.accept('user-1', 'user@example.com')

      expect(invitation.status).toBe(InvitationStatus.ACCEPTED)
      expect(invitation.isPending()).toBe(false)
    })

    it('should refuse when the email does not match', () => {
      const invitation = create()

      expect(() => invitation.accept('user-1', 'someone@else.com')).toThrow(
        'Invitation email does not match user email',
      )
    })

    it('should refuse a second accept（一次性凭证）', () => {
      const invitation = create()
      invitation.accept('user-1', 'user@example.com')

      expect(() => invitation.accept('user-1', 'user@example.com')).toThrow(
        'Invitation has already been used or cancelled',
      )
    })

    it('should mark expired and refuse when past the deadline', () => {
      const invitation = Invitation.fromPersistence(
        'invitation-1',
        'org-1',
        'user@example.com',
        OrganizationRole.MEMBER,
        'inviter-1',
        InvitationStatus.PENDING,
        'token-123',
        new Date(Date.now() - 1000),
        new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      )

      expect(invitation.isExpired()).toBe(true)
      expect(() => invitation.accept('user-1', 'user@example.com')).toThrow('Invitation has expired')
      expect(invitation.status).toBe(InvitationStatus.EXPIRED)
    })
  })

  describe('cancel', () => {
    it('should let an owner cancel any pending invitation', () => {
      const invitation = create()

      invitation.cancel('someone-else', true)

      expect(invitation.status).toBe(InvitationStatus.CANCELLED)
    })

    it('should let the inviter cancel their own invitation', () => {
      const invitation = create()

      invitation.cancel('inviter-1', false)

      expect(invitation.status).toBe(InvitationStatus.CANCELLED)
    })

    it('should refuse a non-owner who is not the inviter', () => {
      const invitation = create()

      expect(() => invitation.cancel('stranger', false)).toThrow(
        'You do not have permission to cancel this invitation',
      )
    })

    it('should refuse cancelling a non-pending invitation', () => {
      const invitation = create()
      invitation.accept('user-1', 'user@example.com')

      expect(() => invitation.cancel('inviter-1', false)).toThrow(
        'Can only cancel pending invitations',
      )
    })
  })

  describe('expire', () => {
    it('should move a past-deadline pending invitation to expired', () => {
      const invitation = Invitation.fromPersistence(
        'invitation-1',
        'org-1',
        'user@example.com',
        OrganizationRole.MEMBER,
        'inviter-1',
        InvitationStatus.PENDING,
        'token-123',
        new Date(Date.now() - 1000),
        new Date(),
      )

      invitation.expire()

      expect(invitation.status).toBe(InvitationStatus.EXPIRED)
    })
  })
})
