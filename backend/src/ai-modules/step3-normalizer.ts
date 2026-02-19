/**
 * Normalizes AI-generated step3 state flow into canonical shape:
 * { states: [{ name, initial?, final? }], transitions: [{ from, to, guard?, action? }] }
 *
 * Handles AI prompt shape: states: [{ name, initial, transitions: ["targetState"] }]
 * and other variants (e.g. already having transitions as from/to).
 */

import type { Step3StateFlowCanonical, Step3StateItem, Step3TransitionItem } from './step3-stateflow.schema'
import { validateStep3StateFlow } from './step3-stateflow.schema'

/** AI format: each state has an optional transitions array of target state names */
interface AIStateWithTransitions {
  name?: string
  id?: string
  initial?: boolean
  final?: boolean
  transitions?: string[]
  metadata?: Record<string, unknown>
}

/**
 * Normalize step3 state flow from AI or other sources into canonical form.
 * - If states[].transitions exist, expand to transitions: [{ from, to }].
 * - Set final: true for states with no outgoing transition.
 * - Ensures exactly one initial state.
 */
export function normalizeStep3StateFlow(raw: unknown): Step3StateFlowCanonical | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const obj = raw as Record<string, unknown>
  const statesRaw = obj.states
  const transitionsRaw = obj.transitions

  const states: Step3StateItem[] = []
  const transitions: Step3TransitionItem[] = []
  const stateNames = new Set<string>()

  // Build states and infer transitions from states[].transitions if present
  if (Array.isArray(statesRaw) && statesRaw.length > 0) {
    const hasExplicitTransitions = Array.isArray(transitionsRaw) && transitionsRaw.length > 0

    for (const s of statesRaw) {
      const item = s as AIStateWithTransitions
      const name = (item.name || item.id || '').toString().trim()
      if (!name) continue
      stateNames.add(name)
      states.push({
        name,
        initial: item.initial === true,
        final: item.final === true,
        metadata: item.metadata && typeof item.metadata === 'object' ? (item.metadata as Record<string, unknown>) : undefined,
      })

      if (!hasExplicitTransitions && Array.isArray(item.transitions)) {
        for (const to of item.transitions) {
          const toStr = (to && typeof to === 'string' ? to : String(to)).trim()
          if (toStr) {
            transitions.push({ from: name, to: toStr })
            if (!stateNames.has(toStr)) {
              stateNames.add(toStr)
              states.push({ name: toStr, initial: false, final: false })
            }
          }
        }
      }
    }

    if (Array.isArray(transitionsRaw) && transitionsRaw.length > 0) {
      for (const t of transitionsRaw) {
        const tr = t as Record<string, unknown>
        const from = (tr.from ?? tr.source) as string
        const to = (tr.to ?? tr.target) as string
        if (from && to) {
          transitions.push({
            from: String(from).trim(),
            to: String(to).trim(),
            guard: typeof tr.guard === 'string' ? tr.guard : undefined,
            action: typeof tr.action === 'string' ? tr.action : undefined,
            metadata: tr.metadata && typeof tr.metadata === 'object' ? (tr.metadata as Record<string, unknown>) : undefined,
          })
        }
      }
    }

    // Ensure exactly one initial
    const initialCount = states.filter((s) => s.initial).length
    if (initialCount === 0 && states.length > 0) {
      states[0].initial = true
    } else if (initialCount > 1) {
      for (let i = 1; i < states.length; i++) {
        states[i].initial = false
      }
    }

    // Set final for states with no outgoing transition
    const hasOutgoing = new Set(transitions.map((t) => t.from))
    for (const s of states) {
      if (s.final !== true && !hasOutgoing.has(s.name)) {
        s.final = true
      }
    }
  } else if (Array.isArray(transitionsRaw) && transitionsRaw.length > 0) {
    // Infer states from transitions only
    const inferred = new Set<string>()
    for (const t of transitionsRaw) {
      const tr = t as Record<string, unknown>
      const from = (tr.from ?? tr.source) as string
      const to = (tr.to ?? tr.target) as string
      if (from) inferred.add(String(from).trim())
      if (to) inferred.add(String(to).trim())
    }
    const names = Array.from(inferred)
    for (let i = 0; i < names.length; i++) {
      states.push({
        name: names[i],
        initial: i === 0,
        final: i === names.length - 1 && names.length > 1,
      })
    }
    for (const t of transitionsRaw) {
      const tr = t as Record<string, unknown>
      const from = (tr.from ?? tr.source) as string
      const to = (tr.to ?? tr.target) as string
      if (from && to) {
        transitions.push({
          from: String(from).trim(),
          to: String(to).trim(),
          guard: typeof tr.guard === 'string' ? tr.guard : undefined,
          action: typeof tr.action === 'string' ? tr.action : undefined,
        })
      }
    }
  }

  if (states.length === 0) {
    return null
  }

  const result: Step3StateFlowCanonical = { states, transitions }
  const err = validateStep3StateFlow(result)
  return err === null ? result : null
}

/**
 * Normalize and validate. Returns canonical object or throws with message.
 */
export function normalizeAndValidateStep3StateFlow(raw: unknown): Step3StateFlowCanonical {
  const normalized = normalizeStep3StateFlow(raw)
  if (normalized) {
    return normalized
  }
  const err = raw != null ? validateStep3StateFlow(raw) : 'step3_stateFlow is null or undefined'
  throw new Error(err || 'Invalid step3 state flow')
}

/**
 * Normalize step3 for save. Returns { normalized } or { error } for caller to throw or return.
 */
export function normalizeStep3ForSave(raw: unknown): { normalized: Step3StateFlowCanonical } | { error: string } {
  const normalized = normalizeStep3StateFlow(raw)
  if (normalized) {
    return { normalized }
  }
  const err = raw != null ? validateStep3StateFlow(raw) : 'step3_stateFlow is null or undefined'
  return { error: err || 'Invalid step3 state flow' }
}
