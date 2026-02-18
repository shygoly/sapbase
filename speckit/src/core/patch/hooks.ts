// React hooks for Patch DSL system
'use client'

import { useEffect, useState, useCallback } from 'react'
import type { PatchManager } from './patch-manager'
import type { Patch } from './types'

/**
 * Hook for hot reloading schemas
 */
export function useHotReload(patchManager: PatchManager | null) {
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!patchManager) return

    const unsubscribe = patchManager.onHotReload(() => {
      setReloadKey((prev) => prev + 1)
    })

    return unsubscribe
  }, [patchManager])

  return reloadKey
}

/**
 * Hook for applying patches
 */
export function usePatchApplication(patchManager: PatchManager | null) {
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applyPatch = useCallback(
    async (
      patch: Patch,
      actorPermissions?: string[],
      requireConfirmation?: (patch: Patch, securityLevel: string) => Promise<boolean>
    ) => {
      if (!patchManager) {
        setError('Patch manager not available')
        return null
      }

      setIsApplying(true)
      setError(null)

      try {
        const result = await patchManager.applyPatch(
          patch,
          actorPermissions,
          requireConfirmation as any
        )

        if (!result.success) {
          setError(result.errors?.join(', ') || 'Patch application failed')
        }

        return result
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        setError(errorMessage)
        return null
      } finally {
        setIsApplying(false)
      }
    },
    [patchManager]
  )

  return {
    applyPatch,
    isApplying,
    error,
  }
}

/**
 * Hook for dry-running patches
 */
export function usePatchDryRun(patchManager: PatchManager | null) {
  const [isDryRunning, setIsDryRunning] = useState(false)
  const [result, setResult] = useState<any>(null)

  const dryRun = useCallback(
    async (patch: Patch, actorPermissions?: string[]) => {
      if (!patchManager) {
        return null
      }

      setIsDryRunning(true)

      try {
        const dryRunResult = await patchManager.dryRun(patch, actorPermissions)
        setResult(dryRunResult)
        return dryRunResult
      } catch (err) {
        console.error('Dry run error:', err)
        return null
      } finally {
        setIsDryRunning(false)
      }
    },
    [patchManager]
  )

  return {
    dryRun,
    isDryRunning,
    result,
  }
}
