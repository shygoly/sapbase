/**
 * Domain representation of a workflow history entry (read-only for domain).
 * Persistence shape is in infrastructure.
 */
export interface WorkflowHistoryEntry {
  id: string
  workflowInstanceId: string
  fromState: string | null
  toState: string
  triggeredById: string | null
  timestamp: Date
  guardResult?: {
    passed: boolean
    expression?: string
    error?: string
    type?: string
    reason?: string
  }
  actionResult?: {
    executed: boolean
    action?: string
    error?: string
  }
  metadata?: Record<string, unknown>
}
