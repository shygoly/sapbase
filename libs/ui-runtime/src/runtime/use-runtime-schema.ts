'use client'

import { useEffect, useState } from 'react'
import { schemaResolver } from '../schema/resolver'
import type { ResolvedPageSchema } from '../schema/types'

export interface RuntimeSchemaState {
  schema: ResolvedPageSchema | null
  loading: boolean
  error: string | null
}

/**
 * Resolve a page schema for Runtime components.
 *
 * PageRuntime / FormRuntime / CollectionRuntime keep their permission/layout
 * responsibilities; this hook is the bridge to the Patch DSL schema source.
 */
export function useRuntimeSchema(
  path: string | null | undefined,
  version?: number,
): RuntimeSchemaState {
  const [state, setState] = useState<RuntimeSchemaState>({
    schema: null,
    loading: Boolean(path),
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    if (!path) {
      setState({ schema: null, loading: false, error: null })
      return
    }

    setState((prev) => ({ ...prev, loading: true, error: null }))
    schemaResolver
      .resolvePage(path, version)
      .then((schema) => {
        if (!cancelled) setState({ schema, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            schema: null,
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [path, version])

  return state
}
