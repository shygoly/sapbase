/**
 * Domain event: a patch was generated for an AI module.
 */
export class PatchGeneratedEvent {
  constructor(
    public readonly moduleId: string,
    public readonly organizationId: string,
    public readonly naturalLanguagePrompt: string,
    public readonly generatedAt: Date,
  ) {}
}
