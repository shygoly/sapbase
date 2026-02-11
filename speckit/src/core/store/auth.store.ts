/**
 * Auth Store - Zustand
 * Manages authentication state and user information
 */

import { create } from 'zustand'
import { User } from '@/lib/api/types'
import { authApi } from '@/lib/api/auth.api'
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
  initializeAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authApi.login({ email, password })
      // Update permission store with user permissions
      usePermissionStore.getState().setPermissions(response.user.permissions || [])
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      })
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

  initializeAuth: () => {
    const storedUser = authApi.getStoredUser()
    if (storedUser && authApi.isAuthenticated()) {
      // Restore permissions from stored user
      usePermissionStore.getState().setPermissions(storedUser.permissions || [])
      set({
        user: storedUser,
        isAuthenticated: true,
      })
    }
  },
}))
