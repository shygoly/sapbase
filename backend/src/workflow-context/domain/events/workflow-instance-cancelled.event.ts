/**
 * Domain event: a workflow instance was cancelled.
 */
export class WorkflowInstanceCancelledEvent {
  constructor(
    public readonly instanceId: string,
    public readonly cancelledAt: Date,
  ) {}
}
