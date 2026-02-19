import type { WorkflowHistoryEntry } from '../entities'

/**
 * Port for workflow history persistence (implemented in infrastructure).
 */
export interface IWorkflowHistoryRepository {
  create(entry: {
    workflowInstanceId: string
    fromState: string
    toState: string
    triggeredById: string | null
    guardResult?: Record<string, unknown>
    actionResult?: Record<string, unknown>
  }): Promise<WorkflowHistoryEntry>
  findByInstanceId(workflowInstanceId: string): Promise<WorkflowHistoryEntry[]>
}
