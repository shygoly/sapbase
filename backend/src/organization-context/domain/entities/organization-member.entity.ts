import { DomainError } from '../errors'

export enum OrganizationRole {
  OWNER = 'owner',
  MEMBER = 'member',
}

/**
 * Domain entity: OrganizationMember (pure, no TypeORM).
 */
export class OrganizationMember {
  private constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly userId: string,
    private _role: OrganizationRole,
    public readonly invitedById: string | null,
    public readonly joinedAt: Date,
  ) {}

  get role(): OrganizationRole {
    return this._role
  }

  /** Reconstruct from persistence (no validation). */
  static fromPersistence(
    id: string,
    organizationId: string,
    userId: string,
    role: OrganizationRole,
    invitedById: string | null,
    joinedAt: Date,
  ): OrganizationMember {
    return new OrganizationMember(
      id,
      organizationId,
      userId,
      role,
      invitedById,
      joinedAt,
    )
  }

  static create(
    organizationId: string,
    userId: string,
    role: OrganizationRole,
    invitedById: string,
  ): OrganizationMember {
    return new OrganizationMember(
      '', // ID assigned by repository
      organizationId,
      userId,
      role,
      invitedById,
      new Date(),
    )
  }

  updateRole(newRole: OrganizationRole): void {
    this._role = newRole
  }
}
