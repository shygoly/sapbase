/**
 * Value object for a workflow transition (domain layer).
 */
export interface WorkflowTransitionVO {
  from: string
  to: string
  guard?: string
  action?: string
  metadata?: Record<string, unknown>
}
