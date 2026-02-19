import type { WorkflowInstance } from '../entities'

/**
 * Port for workflow instance persistence (implemented in infrastructure).
 */
export interface IWorkflowInstanceRepository {
  save(instance: WorkflowInstance): Promise<void>
  findById(id: string, organizationId: string): Promise<WorkflowInstance | null>
  findRunningInstance(
    entityType: string,
    entityId: string,
    workflowDefinitionId: string,
    organizationId: string,
  ): Promise<WorkflowInstance | null>
  findAll(
    organizationId: string,
    workflowDefinitionId?: string,
    entityType?: string,
    entityId?: string,
  ): Promise<WorkflowInstance[]>
  updateState(
    id: string,
    toState: string,
    organizationId: string,
    completedAt?: Date | null,
  ): Promise<void>
}
