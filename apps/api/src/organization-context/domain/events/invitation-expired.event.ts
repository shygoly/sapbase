/**
 * Domain event: an invitation expired.
 */
export class InvitationExpiredEvent {
  constructor(
    public readonly invitationId: string,
    public readonly organizationId: string,
    public readonly email: string,
    public readonly expiredAt: Date,
  ) {}
}
