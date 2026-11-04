import { OrganizationRole } from '../entities'

/**
 * Domain event: an invitation was accepted.
 */
export class InvitationAcceptedEvent {
  constructor(
    public readonly invitationId: string,
    public readonly organizationId: string,
    public readonly userId: string,
    public readonly email: string,
    public readonly role: OrganizationRole,
    public readonly acceptedAt: Date,
  ) {}
}
