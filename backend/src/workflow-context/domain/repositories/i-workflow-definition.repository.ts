import type { WorkflowDefinition } from '../entities'

/**
 * Port for workflow definition persistence (implemented in infrastructure).
 */
export interface IWorkflowDefinitionRepository {
  findById(id: string, organizationId: string): Promise<WorkflowDefinition | null>
  save(definition: WorkflowDefinition): Promise<void>
  findAll(organizationId: string, entityType?: string): Promise<WorkflowDefinition[]>
}
