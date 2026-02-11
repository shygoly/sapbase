'use client'

import { useState, useCallback, useEffect } from 'react'
import { StateMachine } from './engine'
import type { StateMachineDefinition, StateMachineState } from './types'

export function useStateMachine(definition: StateMachineDefinition, initialContext?: Record<string, any>) {
  const [machine] = useState(() => new StateMachine(definition, initialContext))
  const [state, setState] = useState<StateMachineState>(machine.getState())

  const send = useCallback((event: string, payload?: any) => {
    const success = machine.send(event, payload)
    if (success) {
      setState(machine.getState())
    }
    return success
  }, [machine])

  const can = useCallback((event: string) => machine.can(event), [machine])

  const matches = useCallback((state: string) => machine.matches(state), [machine])

  const updateContext = useCallback((updates: Record<string, any>) => {
    machine.updateContext(updates)
    setState(machine.getState())
  }, [machine])

  const getAvailableTransitions = useCallback(() => machine.getAvailableTransitions(), [machine])

  return {
    state: state.value,
    context: state.context,
    history: state.history,
    send,
    can,
    matches,
    updateContext,
    getAvailableTransitions,
  }
}
