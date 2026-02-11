'use client'

import { useState, useEffect, useCallback } from 'react'
import { useNotification } from '@/core/notification/hooks'

export interface UseFetchOptions {
  immediate?: boolean
  onError?: (error: Error) => void
  onSuccess?: (data: any) => void
}

export function useFetch<T>(
  url: string,
  options?: UseFetchOptions & RequestInit
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const { error: notifyError } = useNotification()

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await global.fetch(url, options)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const result = await response.json()
      setData(result)
      options?.onSuccess?.(result)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      notifyError('Error', error.message)
      options?.onError?.(error)
    } finally {
      setLoading(false)
    }
  }, [url, options, notifyError])

  useEffect(() => {
    if (options?.immediate !== false) {
      fetch()
    }
  }, [fetch, options?.immediate])

  return { data, loading, error, refetch: fetch }
}
