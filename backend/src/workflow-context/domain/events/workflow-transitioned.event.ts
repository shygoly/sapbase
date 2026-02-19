/**
 * Domain event: a workflow transition was executed.
 */
export class WorkflowTransitionedEvent {
  constructor(
    public readonly instanceId: string,
    public readonly fromState: string,
    public readonly toState: string,
    public readonly triggeredById: string,
    public readonly timestamp: Date,
  ) {}
}
