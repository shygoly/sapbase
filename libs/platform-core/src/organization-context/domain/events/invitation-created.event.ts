import { OrganizationRole } from '../entities'

/**
 * Domain event: an invitation was created.
 */
export class InvitationCreatedEvent {
  constructor(
    public readonly invitationId: string,
    public readonly organizationId: string,
    public readonly email: string,
    public readonly role: OrganizationRole,
    public readonly invitedById: string,
    public readonly expiresAt: Date | null,
    public readonly createdAt: Date,
  ) {}
}
