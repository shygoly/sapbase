/**
 * Value object for a workflow state (domain layer).
 */
export interface WorkflowStateVO {
  name: string
  initial?: boolean
  final?: boolean
  metadata?: Record<string, unknown>
}
