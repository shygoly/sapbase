/**
 * Domain event: an organization was created.
 */
export class OrganizationCreatedEvent {
  constructor(
    public readonly organizationId: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly creatorUserId: string,
    public readonly createdAt: Date,
  ) {}
}
