/**
 * Canonical schema for step3_stateFlow.
 * Used to validate and normalize AI output before save and before workflow conversion.
 */

export interface Step3StateItem {
  name: string
  initial?: boolean
  final?: boolean
  metadata?: Record<string, unknown>
}

export interface Step3TransitionItem {
  from: string
  to: string
  guard?: string
  action?: string
  metadata?: Record<string, unknown>
}

export interface Step3StateFlowCanonical {
  states: Step3StateItem[]
  transitions: Step3TransitionItem[]
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Validates normalized step3 state flow.
 * Returns null if valid; returns error message string if invalid.
 */
export function validateStep3StateFlow(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return 'step3_stateFlow must be an object'
  }

  const obj = data as Record<string, unknown>
  const states = obj.states
  const transitions = obj.transitions

  if (!Array.isArray(states) || states.length === 0) {
    return 'step3_stateFlow must have a non-empty states array'
  }

  const stateNames = new Set<string>()
  let hasInitial = false

  for (let i = 0; i < states.length; i++) {
    const s = states[i]
    if (!s || typeof s !== 'object') {
      return `states[${i}] must be an object`
    }
    const name = (s as Record<string, unknown>).name
    if (!isNonEmptyString(name)) {
      return `states[${i}].name must be a non-empty string`
    }
    if (stateNames.has(name)) {
      return `states: duplicate state name "${name}"`
    }
    stateNames.add(name)
    const initial = (s as Record<string, unknown>).initial
    if (initial === true) {
      hasInitial = true
    }
  }

  if (!hasInitial) {
    return 'step3_stateFlow must have exactly one state with initial: true'
  }

  const initialCount = states.filter((s) => (s as Record<string, unknown>).initial === true).length
  if (initialCount > 1) {
    return 'step3_stateFlow must have exactly one initial state'
  }

  if (!Array.isArray(transitions)) {
    return 'step3_stateFlow must have a transitions array'
  }

  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i]
    if (!t || typeof t !== 'object') {
      return `transitions[${i}] must be an object`
    }
    const from = (t as Record<string, unknown>).from
    const to = (t as Record<string, unknown>).to
    if (!isNonEmptyString(from)) {
      return `transitions[${i}].from must be a non-empty string`
    }
    if (!isNonEmptyString(to)) {
      return `transitions[${i}].to must be a non-empty string`
    }
    if (!stateNames.has(from)) {
      return `transitions[${i}]: from state "${from}" not found in states`
    }
    if (!stateNames.has(to)) {
      return `transitions[${i}]: to state "${to}" not found in states`
    }
  }

  return null
}
