/**
 * Domain event: an AI module was unpublished.
 */
export class ModuleUnpublishedEvent {
  constructor(
    public readonly moduleId: string,
    public readonly organizationId: string,
    public readonly unpublishedAt: Date,
  ) {}
}
