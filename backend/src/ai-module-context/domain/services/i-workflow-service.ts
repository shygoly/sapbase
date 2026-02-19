/**
 * Port for workflow service (implemented in infrastructure).
 */
export interface IWorkflowService {
  getWorkflowContext(
    entityType: string,
    entityId: string,
    organizationId: string,
  ): Promise<string | null>
}
