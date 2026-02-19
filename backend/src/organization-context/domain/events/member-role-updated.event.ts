import { OrganizationRole } from '../entities'

/**
 * Domain event: a member's role was updated.
 */
export class MemberRoleUpdatedEvent {
  constructor(
    public readonly organizationId: string,
    public readonly userId: string,
    public readonly oldRole: OrganizationRole,
    public readonly newRole: OrganizationRole,
    public readonly updatedById: string,
    public readonly updatedAt: Date,
  ) {}
}
