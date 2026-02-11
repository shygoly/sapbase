import type {
  StateMachineDefinition,
  StateMachineState,
  StateMachineInstance,
  TransitionDefinition,
} from './types'

export class StateMachine {
  private definition: StateMachineDefinition
  private state: StateMachineState

  constructor(definition: StateMachineDefinition, initialContext: Record<string, any> = {}) {
    this.definition = definition
    this.state = {
      value: definition.initial,
      context: { ...definition.context, ...initialContext },
      history: [definition.initial],
      timestamp: Date.now(),
    }
  }

  private findTransition(event: string): TransitionDefinition | undefined {
    return this.definition.transitions.find(
      t => t.from === this.state.value && t.event === event
    )
  }

  private canTransition(transition: TransitionDefinition): boolean {
    if (!transition.guard) return true
    return transition.guard(this.state.context)
  }

  send(event: string, payload?: any): boolean {
    const transition = this.findTransition(event)
    if (!transition) return false

    if (!this.canTransition(transition)) return false

    const fromState = this.definition.states[this.state.value]
    const toState = this.definition.states[transition.to]

    if (fromState?.onExit) {
      this.executeAction(fromState.onExit)
    }

    if (transition.action) {
      transition.action({ ...this.state.context, ...payload })
    }

    if (toState?.onEnter) {
      this.executeAction(toState.onEnter)
    }

    this.state.value = transition.to
    this.state.history.push(transition.to)
    this.state.timestamp = Date.now()

    return true
  }

  private executeAction(action: string): void {
    // Action execution logic
    void action
  }

  can(event: string): boolean {
    const transition = this.findTransition(event)
    if (!transition) return false
    return this.canTransition(transition)
  }

  matches(state: string): boolean {
    return this.state.value === state
  }

  getState(): StateMachineState {
    return { ...this.state }
  }

  getContext(): Record<string, any> {
    return { ...this.state.context }
  }

  updateContext(updates: Record<string, any>): void {
    this.state.context = { ...this.state.context, ...updates }
  }

  getAvailableTransitions(): string[] {
    return this.definition.transitions
      .filter(t => t.from === this.state.value && this.canTransition(t))
      .map(t => t.event)
  }

  reset(): void {
    this.state = {
      value: this.definition.initial,
      context: { ...this.definition.context },
      history: [this.definition.initial],
      timestamp: Date.now(),
    }
  }
}
