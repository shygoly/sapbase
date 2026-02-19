/**
 * Domain event: a member was removed from an organization.
 */
export class MemberRemovedEvent {
  constructor(
    public readonly organizationId: string,
    public readonly userId: string,
    public readonly removerId: string,
    public readonly removedAt: Date,
  ) {}
}
