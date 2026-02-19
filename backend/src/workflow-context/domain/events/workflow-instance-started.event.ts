/**
 * Domain event: a workflow instance was started.
 */
export class WorkflowInstanceStartedEvent {
  constructor(
    public readonly instanceId: string,
    public readonly workflowDefinitionId: string,
    public readonly entityType: string,
    public readonly entityId: string,
  ) {}
}
