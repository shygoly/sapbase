/**
 * Domain event: a test run was completed for an AI module.
 */
export class TestRunCompletedEvent {
  constructor(
    public readonly moduleId: string,
    public readonly organizationId: string,
    public readonly testCount: number,
    public readonly passedCount: number,
    public readonly failedCount: number,
    public readonly completedAt: Date,
  ) {}
}
