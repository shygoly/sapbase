/**
 * Domain event: an invitation was cancelled.
 */
export class InvitationCancelledEvent {
  constructor(
    public readonly invitationId: string,
    public readonly organizationId: string,
    public readonly email: string,
    public readonly cancelledById: string,
    public readonly cancelledAt: Date,
  ) {}
}
