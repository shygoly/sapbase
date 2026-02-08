// State Machine Type Definitions

export type StateValue = string | number | boolean

export interface StateDefinition {
  name: string
  type?: 'initial' | 'final' | 'compound'
  onEnter?: string
  onExit?: string
  meta?: Record<string, any>
}

export interface TransitionDefinition {
  from: string
  to: string
  event: string
  guard?: (context: any) => boolean
  action?: (context: any) => void
  meta?: Record<string, any>
}

export interface StateMachineDefinition {
  id: string
  initial: string
  states: Record<string, StateDefinition>
  transitions: TransitionDefinition[]
  context?: Record<string, any>
  meta?: Record<string, any>
}

export interface StateMachineState {
  value: string
  context: Record<string, any>
  history: string[]
  timestamp: number
}

export interface StateMachineInstance {
  state: StateMachineState
  send: (event: string, payload?: any) => boolean
  can: (event: string) => boolean
  matches: (state: string) => boolean
  getContext: () => Record<string, any>
  updateContext: (updates: Record<string, any>) => void
}

export interface WorkflowDefinition {
  id: string
  name: string
  description?: string
  states: Record<string, StateDefinition>
  transitions: TransitionDefinition[]
  approvers?: Record<string, string[]>
  meta?: Record<string, any>
}

export interface WorkflowInstance {
  id: string
  workflowId: string
  currentState: string
  context: Record<string, any>
  history: WorkflowHistoryEntry[]
  createdAt: Date
  updatedAt: Date
}

export interface WorkflowHistoryEntry {
  from: string
  to: string
  event: string
  actor: string
  timestamp: Date
  comment?: string
  metadata?: Record<string, any>
}

export interface ApprovalTask {
  id: string
  workflowId: string
  state: string
  assignee: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: Date
  dueDate?: Date
  comment?: string
}
