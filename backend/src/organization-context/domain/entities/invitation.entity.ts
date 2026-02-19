import { DomainError, BusinessRuleViolation } from '../errors'
import { OrganizationRole } from './organization-member.entity'

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

/**
 * Domain entity: Invitation (pure, no TypeORM).
 */
export class Invitation {
  private constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly email: string,
    public readonly role: OrganizationRole,
    public readonly invitedById: string,
    private _status: InvitationStatus,
    public readonly token: string,
    public readonly expiresAt: Date | null,
    public readonly invitedAt: Date,
  ) {}

  get status(): InvitationStatus {
    return this._status
  }

  /** Reconstruct from persistence (no validation). */
  static fromPersistence(
    id: string,
    organizationId: string,
    email: string,
    role: OrganizationRole,
    invitedById: string,
    status: InvitationStatus,
    token: string,
    expiresAt: Date | null,
    invitedAt: Date,
  ): Invitation {
    return new Invitation(
      id,
      organizationId,
      email,
      role,
      invitedById,
      status,
      token,
      expiresAt,
      invitedAt,
    )
  }

  static create(
    organizationId: string,
    email: string,
    role: OrganizationRole,
    invitedById: string,
    token: string,
    expiresInDays: number = 7,
  ): Invitation {
    if (!email || !email.includes('@')) {
      throw new DomainError('Invalid email address')
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    return new Invitation(
      '', // ID assigned by repository
      organizationId,
      email.toLowerCase().trim(),
      role,
      invitedById,
      InvitationStatus.PENDING,
      token,
      expiresAt,
      new Date(),
    )
  }

  accept(userId: string, userEmail: string): void {
    if (this._status !== InvitationStatus.PENDING) {
      throw new BusinessRuleViolation('Invitation has already been used or cancelled')
    }

    if (this.isExpired()) {
      this._status = InvitationStatus.EXPIRED
      throw new BusinessRuleViolation('Invitation has expired')
    }

    if (this.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw new BusinessRuleViolation('Invitation email does not match user email')
    }

    this._status = InvitationStatus.ACCEPTED
  }

  expire(): void {
    if (this._status === InvitationStatus.PENDING && this.isExpired()) {
      this._status = InvitationStatus.EXPIRED
    }
  }

  cancel(cancellerId: string, isOwner: boolean): void {
    if (this._status !== InvitationStatus.PENDING) {
      throw new BusinessRuleViolation('Can only cancel pending invitations')
    }

    if (!isOwner && this.invitedById !== cancellerId) {
      throw new BusinessRuleViolation('You do not have permission to cancel this invitation')
    }

    this._status = InvitationStatus.CANCELLED
  }

  isExpired(): boolean {
    if (!this.expiresAt) {
      return false
    }
    return this.expiresAt < new Date()
  }

  isPending(): boolean {
    return this._status === InvitationStatus.PENDING && !this.isExpired()
  }
}
