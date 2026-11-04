import { OrganizationRole } from '../entities'

/**
 * Domain event: a member was added to an organization.
 */
export class MemberAddedEvent {
  constructor(
    public readonly organizationId: string,
    public readonly userId: string,
    public readonly role: OrganizationRole,
    public readonly invitedById: string | null,
    public readonly createdAt: Date,
  ) {}
}
