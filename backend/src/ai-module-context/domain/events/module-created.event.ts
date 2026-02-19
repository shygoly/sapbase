/**
 * Domain event: an AI module was created.
 */
export class ModuleCreatedEvent {
  constructor(
    public readonly moduleId: string,
    public readonly organizationId: string,
    public readonly name: string,
    public readonly createdById: string | null,
    public readonly createdAt: Date,
  ) {}
}
