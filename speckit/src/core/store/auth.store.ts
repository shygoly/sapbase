/**
 * Auth Store - Zustand
 * Manages authentication state and user information
 */

import { create } from 'zustand'
import { User } from '@/lib/api/types'
import { authApi } from '@/lib/api/auth.api'
import { apiClient } from '@/lib/api/client'
import { usePermissionStore } from './permission.store'

interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
  isAuthenticated: boolean

  // Actions
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchProfile: () => Promise<void>
  initializeAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  login: async (email: string, password: string, organizationId?: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authApi.login({ email, password, organizationId })
      console.log('Login response:', response)
      // Update permission store with user permissions
      usePermissionStore.getState().setPermissions(response.user?.permissions || [])
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      })
      // Verify token is stored
      const token = apiClient.getAuthToken()
      console.log('Token stored after login:', token ? 'Yes' : 'No')
      
      // Load organizations after login
      const { useOrganizationStore } = await import('./organization.store')
      if (response.organizations) {
        useOrganizationStore.getState().setOrganizations(response.organizations)
        if (response.currentOrganizationId) {
          const currentOrg = response.organizations.find(org => org.id === response.currentOrganizationId)
          if (currentOrg) {
            useOrganizationStore.getState().setCurrentOrganization(currentOrg)
          }
        } else if (response.organizations.length === 1) {
          useOrganizationStore.getState().setCurrentOrganization(response.organizations[0])
        }
      } else {
        useOrganizationStore.getState().loadOrganizations()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      set({
        error: message,
        isLoading: false,
        isAuthenticated: false,
      })
      throw error
    }
  },

  logout: async () => {
    set({ isLoading: true })
    try {
      await authApi.logout()
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout failed'
      set({
        error: message,
        isLoading: false,
      })
    }
  },

  fetchProfile: async () => {
    set({ isLoading: true, error: null })
    try {
      const user = await authApi.getProfile()
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch profile'
      set({
        error: message,
        isLoading: false,
        isAuthenticated: false,
      })
    }
  },

  initializeAuth: async () => {
    console.log('Initializing auth...')
    const storedUser = authApi.getStoredUser()
    const hasToken = authApi.isAuthenticated()
    console.log('Stored user:', storedUser ? 'Found' : 'Not found')
    console.log('Has token:', hasToken)
    
    if (storedUser && hasToken) {
      // Restore permissions from stored user
      usePermissionStore.getState().setPermissions(storedUser.permissions || [])
      set({
        user: storedUser,
        isAuthenticated: true,
        isLoading: true,
      })
      
      // Verify token is still valid by fetching profile
      try {
        console.log('Validating token with backend...')
        const user = await authApi.getProfile()
        console.log('Token validation successful, user:', user.email)
        // Token is valid, update user info
        usePermissionStore.getState().setPermissions(user.permissions || [])
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        })
        
        // Load organizations after auth is initialized
        const { useOrganizationStore } = await import('./organization.store')
        useOrganizationStore.getState().loadOrganizations()
      } catch (error) {
        // Token is invalid, clear auth
        console.warn('Token validation failed, clearing auth:', error)
        authApi.logout()
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        })
      }
    } else {
      console.log('No stored user or token, setting isLoading to false')
      set({ isLoading: false })
    }
  },
}))
