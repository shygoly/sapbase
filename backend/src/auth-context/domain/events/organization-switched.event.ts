/**
 * Domain event: user switched organization.
 */
export class OrganizationSwitchedEvent {
  constructor(
    public readonly userId: string,
    public readonly oldOrganizationId: string | undefined,
    public readonly newOrganizationId: string,
    public readonly switchedAt: Date,
  ) {}
}
