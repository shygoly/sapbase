/**
 * Domain event: a workflow instance reached a final state.
 */
export class WorkflowInstanceCompletedEvent {
  constructor(
    public readonly instanceId: string,
    public readonly finalState: string,
    public readonly completedAt: Date,
  ) {}
}
