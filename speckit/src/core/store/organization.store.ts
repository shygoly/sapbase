'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { organizationsApi, Organization } from '@/lib/api/organizations.api'
import { authApi } from '@/lib/api/auth.api'
import { apiClient } from '@/lib/api/client'

interface OrganizationState {
  currentOrganization: Organization | null
  organizations: Organization[]
  isLoading: boolean
  error: string | null

  // Actions
  setCurrentOrganization: (org: Organization | null) => void
  setOrganizations: (orgs: Organization[]) => void
  loadOrganizations: () => Promise<void>
  switchOrganization: (organizationId: string) => Promise<void>
  createOrganization: (name: string) => Promise<Organization>
  updateOrganization: (id: string, updates: Partial<Organization>) => Promise<Organization>
  clear: () => void
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set, get) => ({
      currentOrganization: null,
      organizations: [],
      isLoading: false,
      error: null,

      setCurrentOrganization: (org) => {
        set({ currentOrganization: org })
        if (org && typeof window !== 'undefined') {
          apiClient.setOrganizationId(org.id)
        }
      },

      setOrganizations: (orgs) => {
        set({ organizations: orgs })
        // Auto-select first organization if none selected
        const { currentOrganization } = get()
        if (!currentOrganization && orgs.length > 0) {
          get().setCurrentOrganization(orgs[0])
        }
      },

      loadOrganizations: async () => {
        set({ isLoading: true, error: null })
        try {
          const orgs = await organizationsApi.findAll()
          set({ organizations: orgs, isLoading: false })

          // Restore current organization from localStorage or select first
          const storedOrgId = apiClient.getOrganizationId()
          if (storedOrgId) {
            const org = orgs.find((o) => o.id === storedOrgId)
            if (org) {
              get().setCurrentOrganization(org)
            } else if (orgs.length > 0) {
              get().setCurrentOrganization(orgs[0])
            }
          } else if (orgs.length > 0) {
            get().setCurrentOrganization(orgs[0])
          }
        } catch (error: any) {
          set({
            error: error.message || 'Failed to load organizations',
            isLoading: false,
          })
        }
      },

      switchOrganization: async (organizationId: string) => {
        set({ isLoading: true, error: null })
        try {
          // Switch organization via auth API (updates JWT token)
          await authApi.switchOrganization(organizationId)

          // Update local state
          const org = get().organizations.find((o) => o.id === organizationId)
          if (org) {
            get().setCurrentOrganization(org)
          }

          // Reload page to refresh all data with new organization context
          if (typeof window !== 'undefined') {
            window.location.reload()
          }

          set({ isLoading: false })
        } catch (error: any) {
          set({
            error: error.message || 'Failed to switch organization',
            isLoading: false,
          })
          throw error
        }
      },

      createOrganization: async (name: string) => {
        set({ isLoading: true, error: null })
        try {
          const newOrg = await organizationsApi.create(name)
          const updatedOrgs = [...get().organizations, newOrg]
          set({ organizations: updatedOrgs, isLoading: false })
          get().setCurrentOrganization(newOrg)
          return newOrg
        } catch (error: any) {
          set({
            error: error.message || 'Failed to create organization',
            isLoading: false,
          })
          throw error
        }
      },

      updateOrganization: async (id: string, updates: Partial<Organization>) => {
        set({ isLoading: true, error: null })
        try {
          const updatedOrg = await organizationsApi.update(id, updates)
          const updatedOrgs = get().organizations.map((org) =>
            org.id === id ? updatedOrg : org,
          )
          set({ organizations: updatedOrgs, isLoading: false })

          // Update current organization if it's the one being updated
          if (get().currentOrganization?.id === id) {
            get().setCurrentOrganization(updatedOrg)
          }

          return updatedOrg
        } catch (error: any) {
          set({
            error: error.message || 'Failed to update organization',
            isLoading: false,
          })
          throw error
        }
      },

      clear: () => {
        set({
          currentOrganization: null,
          organizations: [],
          isLoading: false,
          error: null,
        })
        if (typeof window !== 'undefined') {
          apiClient.setOrganizationId('')
        }
      },
    }),
    {
      name: 'organization-storage',
      partialize: (state) => ({
        currentOrganization: state.currentOrganization,
        organizations: state.organizations,
      }),
    },
  ),
)
