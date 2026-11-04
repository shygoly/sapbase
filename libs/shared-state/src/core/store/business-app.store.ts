'use client'

import { create } from 'zustand'
import {
  businessAppsApi,
  type BusinessAppInstallation,
} from '@sap/api-client/api/business-apps.api'
import { apiClient } from '@sap/api-client/api/client'

interface BusinessAppState {
  currentApplication: BusinessAppInstallation | null
  applications: BusinessAppInstallation[]
  isLoading: boolean
  error: string | null

  loadApplications: () => Promise<void>
  switchApplication: (installationId: string) => void
  setCurrentApplication: (application: BusinessAppInstallation | null) => void
  clear: () => void
}

export const useBusinessAppStore = create<BusinessAppState>((set, get) => ({
  currentApplication: null,
  applications: [],
  isLoading: false,
  error: null,

  setCurrentApplication: (application) => {
    set({ currentApplication: application })
    apiClient.setAppId(application?.id ?? '')
  },

  loadApplications: async () => {
    set({ isLoading: true, error: null })
    try {
      const applications = await businessAppsApi.findAll()
      const active = applications.filter((item) => item.status === 'active')
      const previousId = apiClient.getAppId()
      const restored = active.find((item) => item.id === previousId)
      const current = restored ?? active[0] ?? null

      set({
        applications,
        currentApplication: current,
        isLoading: false,
      })
      apiClient.setAppId(current?.id ?? '')
    } catch (error) {
      set({
        applications: [],
        currentApplication: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load applications',
      })
      apiClient.setAppId('')
    }
  },

  switchApplication: (installationId) => {
    if (installationId === get().currentApplication?.id) return
    const application =
      get().applications.find((item) => item.id === installationId) ?? null
    if (application?.status !== 'active') return

    get().setCurrentApplication(application)
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  },

  clear: () => {
    set({
      currentApplication: null,
      applications: [],
      isLoading: false,
      error: null,
    })
    apiClient.setAppId('')
  },
}))
