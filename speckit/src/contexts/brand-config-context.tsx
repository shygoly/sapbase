'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { brandConfigApi, type BrandConfig, type UpdateBrandConfigDto } from '@/lib/api/brand-config'
import { useOrganizationStore } from '@/core/store/organization.store'

interface BrandConfigContextValue {
  config: BrandConfig | null
  loading: boolean
  error: Error | null
  updateConfig: (data: UpdateBrandConfigDto) => Promise<void>
  refreshConfig: () => Promise<void>
}

const BrandConfigContext = createContext<BrandConfigContextValue | undefined>(undefined)

export function BrandConfigProvider({ children }: { children: React.ReactNode }) {
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization)
  const [config, setConfig] = useState<BrandConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchConfig = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await brandConfigApi.getBrandConfig(currentOrganization.id)
      setConfig(data)
    } catch (err) {
      // If config doesn't exist, that's okay - use defaults
      if ((err as any)?.response?.status === 404) {
        setConfig(null)
      } else {
        setError(err as Error)
      }
    } finally {
      setLoading(false)
    }
  }, [currentOrganization?.id])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const updateConfig = useCallback(
    async (data: UpdateBrandConfigDto) => {
      if (!currentOrganization?.id) {
        throw new Error('No organization selected')
      }

      try {
        setError(null)
        const updated = await brandConfigApi.updateBrandConfig(currentOrganization.id, data)
        setConfig(updated)
      } catch (err) {
        setError(err as Error)
        throw err
      }
    },
    [currentOrganization?.id],
  )

  const refreshConfig = useCallback(async () => {
    await fetchConfig()
  }, [fetchConfig])

  return (
    <BrandConfigContext.Provider
      value={{
        config,
        loading,
        error,
        updateConfig,
        refreshConfig,
      }}
    >
      {children}
    </BrandConfigContext.Provider>
  )
}

export function useBrandConfig() {
  const context = useContext(BrandConfigContext)
  if (context === undefined) {
    throw new Error('useBrandConfig must be used within BrandConfigProvider')
  }
  return context
}
