/**
 * Domain event: an AI module was published.
 */
export class ModulePublishedEvent {
  constructor(
    public readonly moduleId: string,
    public readonly organizationId: string,
    public readonly version: string,
    public readonly publishedAt: Date,
  ) {}
}
