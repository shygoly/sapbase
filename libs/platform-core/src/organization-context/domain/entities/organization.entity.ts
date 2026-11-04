import { DomainError, BusinessRuleViolation } from '../errors'
import { OrganizationSlug } from '../value-objects'
import type { OrganizationMember } from './organization-member.entity'
import { OrganizationRole } from './organization-member.entity'

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
  TRIALING = 'trialing',
  INCOMPLETE = 'incomplete',
  INCOMPLETE_EXPIRED = 'incomplete_expired',
}

/**
 * Domain entity: Organization (pure, no TypeORM).
 */
export class Organization {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    private readonly _slug: OrganizationSlug,
    private readonly _members: OrganizationMember[],
    private _subscriptionStatus: SubscriptionStatus,
    public readonly stripeCustomerId: string | null,
    public readonly stripeSubscriptionId: string | null,
    public readonly stripeProductId: string | null,
    public readonly planName: string | null,
  ) {}

  get slug(): string {
    return this._slug.toString()
  }

  get members(): readonly OrganizationMember[] {
    return this._members
  }

  get subscriptionStatus(): SubscriptionStatus {
    return this._subscriptionStatus
  }

  /** Reconstruct from persistence (no validation). */
  static fromPersistence(
    id: string,
    name: string,
    slug: string,
    members: OrganizationMember[],
    subscriptionStatus: SubscriptionStatus,
    stripeCustomerId: string | null,
    stripeSubscriptionId: string | null,
    stripeProductId: string | null,
    planName: string | null,
  ): Organization {
    return new Organization(
      id,
      name,
      OrganizationSlug.fromString(slug),
      members,
      subscriptionStatus,
      stripeCustomerId,
      stripeSubscriptionId,
      stripeProductId,
      planName,
    )
  }

  static create(
    id: string,
    name: string,
  ): Organization {
    if (!name || name.trim().length === 0) {
      throw new DomainError('Organization name cannot be empty')
    }

    const slug = OrganizationSlug.create(name)
    return new Organization(
      id,
      name.trim(),
      slug,
      [],
      SubscriptionStatus.INCOMPLETE,
      null,
      null,
      null,
      null,
    )
  }

  validateCanAddMember(userId: string): void {
    const existingMember = this._members.find((m) => m.userId === userId)
    if (existingMember) {
      throw new BusinessRuleViolation('User is already a member of this organization')
    }
  }

  addMemberToCollection(member: OrganizationMember): void {
    this.validateCanAddMember(member.userId)
    this._members.push(member)
  }

  removeMember(userId: string, removerId: string): void {
    const removerMember = this._members.find((m) => m.userId === removerId)
    if (!removerMember || removerMember.role !== OrganizationRole.OWNER) {
      throw new BusinessRuleViolation('Only organization owners can remove members')
    }

    const targetMember = this._members.find((m) => m.userId === userId)
    if (!targetMember) {
      throw new BusinessRuleViolation('Member not found')
    }

    const ownerCount = this._members.filter((m) => m.role === OrganizationRole.OWNER).length
    if (targetMember.role === OrganizationRole.OWNER && ownerCount === 1) {
      throw new BusinessRuleViolation('Cannot remove the last owner of an organization')
    }

    const index = this._members.indexOf(targetMember)
    this._members.splice(index, 1)
  }

  updateMemberRole(userId: string, newRole: OrganizationRole, updaterId: string): void {
    const updaterMember = this._members.find((m) => m.userId === updaterId)
    if (!updaterMember || updaterMember.role !== OrganizationRole.OWNER) {
      throw new BusinessRuleViolation('Only organization owners can update member roles')
    }

    const member = this._members.find((m) => m.userId === userId)
    if (!member) {
      throw new BusinessRuleViolation('Member not found')
    }

    const ownerCount = this._members.filter((m) => m.role === OrganizationRole.OWNER).length
    if (member.role === OrganizationRole.OWNER && newRole !== OrganizationRole.OWNER && ownerCount === 1) {
      throw new BusinessRuleViolation('Cannot change role of the last owner')
    }

    member.updateRole(newRole)
  }

  canBeUpdatedBy(userId: string): boolean {
    const member = this._members.find((m) => m.userId === userId)
    return member?.role === OrganizationRole.OWNER
  }

  updateName(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new DomainError('Organization name cannot be empty')
    }
    // Note: slug update handled in application service (needs uniqueness check)
    ;(this as any).name = newName.trim()
  }

  updateSubscriptionStatus(status: SubscriptionStatus): void {
    this._subscriptionStatus = status
  }

  updateStripeIds(customerId: string | null, subscriptionId: string | null, productId: string | null): void {
    ;(this as any).stripeCustomerId = customerId
    ;(this as any).stripeSubscriptionId = subscriptionId
    ;(this as any).stripeProductId = productId
  }

  updatePlanName(planName: string | null): void {
    ;(this as any).planName = planName
  }
}
