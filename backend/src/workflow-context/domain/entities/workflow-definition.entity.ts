import { DomainError } from '../errors'
import type { WorkflowStateVO, WorkflowTransitionVO } from '../value-objects'

export enum WorkflowStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DRAFT = 'draft',
}

/**
 * Domain entity: workflow definition (pure, no TypeORM).
 */
export class WorkflowDefinition {
  private constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly entityType: string,
    public readonly states: WorkflowStateVO[],
    public readonly transitions: WorkflowTransitionVO[],
    private _status: WorkflowStatus,
    public readonly version: string,
    public readonly metadata: Record<string, unknown> | null,
  ) {}

  get status(): WorkflowStatus {
    return this._status
  }

  /** Reconstruct from persistence (no validation). */
  static fromPersistence(
    id: string,
    organizationId: string,
    name: string,
    entityType: string,
    states: WorkflowStateVO[],
    transitions: WorkflowTransitionVO[],
    status: WorkflowStatus,
    description?: string | null,
    version?: string,
    metadata?: Record<string, unknown> | null,
  ): WorkflowDefinition {
    return new WorkflowDefinition(
      id,
      organizationId,
      name,
      description ?? null,
      entityType,
      states,
      transitions,
      status,
      version ?? '1.0.0',
      metadata ?? null,
    )
  }

  static create(
    id: string,
    organizationId: string,
    name: string,
    entityType: string,
    states: WorkflowStateVO[],
    transitions: WorkflowTransitionVO[],
    description?: string | null,
    version = '1.0.0',
    metadata?: Record<string, unknown> | null,
  ): WorkflowDefinition {
    const initialCount = states.filter((s) => s.initial).length
    if (initialCount !== 1) {
      throw new DomainError('Workflow must have exactly one initial state')
    }
    const stateNames = new Set(states.map((s) => s.name))
    for (const t of transitions) {
      if (!stateNames.has(t.from) || !stateNames.has(t.to)) {
        throw new DomainError(`Transition ${t.from} -> ${t.to} references unknown state`)
      }
    }
    return new WorkflowDefinition(
      id,
      organizationId,
      name,
      description ?? null,
      entityType,
      states,
      transitions,
      WorkflowStatus.DRAFT,
      version,
      metadata ?? null,
    )
  }

  ensureCanStart(): void {
    if (this._status !== WorkflowStatus.ACTIVE) {
      throw new DomainError('Cannot start workflow: workflow is not active')
    }
  }

  activate(): void {
    if (this.states.length === 0) {
      throw new DomainError('Cannot activate workflow with no states')
    }
    this._status = WorkflowStatus.ACTIVE
  }

  findTransition(fromState: string, toState: string): WorkflowTransitionVO | null {
    return this.transitions.find((t) => t.from === fromState && t.to === toState) ?? null
  }

  getInitialState(): WorkflowStateVO {
    const initial = this.states.find((s) => s.initial)
    if (!initial) {
      throw new DomainError('No initial state found')
    }
    return initial
  }

  getFinalStates(): WorkflowStateVO[] {
    return this.states.filter((s) => s.final)
  }

  isFinalState(stateName: string): boolean {
    return this.states.some((s) => s.name === stateName && s.final)
  }
}
