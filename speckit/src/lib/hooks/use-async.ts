'use client'

import { useState, useCallback } from 'react'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  immediate: boolean = true
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: immediate,
    error: null,
  })

  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null })
    try {
      const result = await asyncFunction()
      setState({ data: result, loading: false, error: null })
      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error')
      setState({ data: null, loading: false, error: err })
      throw err
    }
  }, [asyncFunction])

  return {
    ...state,
    execute,
  }
}
