'use client'

import { useCallback, useEffect, useState } from 'react'
import { cache } from '../cache'

export function useCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttl?: number; revalidateOnMount?: boolean }
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    const cached = cache.get(key)
    if (cached) {
      setData(cached)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await fetcher()
      cache.set(key, result, options?.ttl)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [key, fetcher, options?.ttl])

  useEffect(() => {
    if (options?.revalidateOnMount || !cache.has(key)) {
      fetchData()
    } else {
      const cached = cache.get(key)
      setData(cached)
    }
  }, [key, fetchData, options?.revalidateOnMount])

  const revalidate = useCallback(() => {
    cache.delete(key)
    fetchData()
  }, [key, fetchData])

  return { data, loading, error, revalidate }
}
