import { DomainError } from '../errors'
import type { WorkflowDefinition } from './workflow-definition.entity'

export enum WorkflowInstanceStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Domain entity: workflow instance (pure, no TypeORM).
 */
export class WorkflowInstance {
  private constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly workflowDefinitionId: string,
    public readonly entityType: string,
    public readonly entityId: string,
    private _currentState: string,
    public readonly context: Record<string, unknown>,
    private _status: WorkflowInstanceStatus,
    public readonly startedById: string | null,
    public readonly startedAt: Date,
    private _completedAt: Date | null,
  ) {}

  get currentState(): string {
    return this._currentState
  }

  get status(): WorkflowInstanceStatus {
    return this._status
  }

  get completedAt(): Date | null {
    return this._completedAt
  }

  /** Reconstruct from persistence (no validation). */
  static fromPersistence(
    id: string,
    organizationId: string,
    workflowDefinitionId: string,
    entityType: string,
    entityId: string,
    currentState: string,
    context: Record<string, unknown>,
    status: WorkflowInstanceStatus,
    startedById: string | null,
    startedAt: Date,
    completedAt: Date | null,
  ): WorkflowInstance {
    return new WorkflowInstance(
      id,
      organizationId,
      workflowDefinitionId,
      entityType,
      entityId,
      currentState,
      context,
      status,
      startedById,
      startedAt,
      completedAt,
    )
  }

  static create(
    id: string,
    organizationId: string,
    workflow: WorkflowDefinition,
    entityType: string,
    entityId: string,
    startedById: string,
    context?: Record<string, unknown>,
  ): WorkflowInstance {
    workflow.ensureCanStart()
    const initialState = workflow.getInitialState()
    return new WorkflowInstance(
      id,
      organizationId,
      workflow.id,
      entityType,
      entityId,
      initialState.name,
      context ?? {},
      WorkflowInstanceStatus.RUNNING,
      startedById,
      new Date(),
      null,
    )
  }

  transitionTo(toState: string, workflow: WorkflowDefinition): void {
    if (this._status !== WorkflowInstanceStatus.RUNNING) {
      throw new DomainError('Cannot transition: instance is not running')
    }
    const transition = workflow.findTransition(this._currentState, toState)
    if (!transition) {
      throw new DomainError(
        `No transition exists from "${this._currentState}" to "${toState}"`,
      )
    }
    this._currentState = toState
    if (workflow.isFinalState(toState)) {
      this._status = WorkflowInstanceStatus.COMPLETED
      this._completedAt = new Date()
    }
  }

  complete(finalState: string): void {
    if (this._status !== WorkflowInstanceStatus.RUNNING) {
      throw new DomainError('Cannot complete: instance is not running')
    }
    this._currentState = finalState
    this._status = WorkflowInstanceStatus.COMPLETED
    this._completedAt = new Date()
  }

  cancel(): void {
    if (this._status !== WorkflowInstanceStatus.RUNNING) {
      throw new DomainError('Cannot cancel: instance is not running')
    }
    this._status = WorkflowInstanceStatus.CANCELLED
    this._completedAt = new Date()
  }
}
