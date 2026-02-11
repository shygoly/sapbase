/**
 * Menu Store - Zustand
 * Manages menu items and navigation state
 */

import { create } from 'zustand'
import { MenuItem } from '@/lib/api/types'
import { menuApi } from '@/lib/api/menu.api'

interface MenuState {
  items: MenuItem[]
  isLoading: boolean
  error: string | null

  // Actions
  setItems: (items: MenuItem[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  fetchMenu: () => Promise<void>
  fetchFilteredMenu: (permissions: string[]) => Promise<void>
  clearMenu: () => void
}

export const useMenuStore = create<MenuState>((set) => ({
  items: [],
  isLoading: false,
  error: null,

  setItems: (items) => set({ items }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  fetchMenu: async () => {
    set({ isLoading: true, error: null })
    try {
      const items = await menuApi.findAll()
      set({
        items,
        isLoading: false,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch menu'
      set({
        error: message,
        isLoading: false,
      })
    }
  },

  fetchFilteredMenu: async (permissions: string[]) => {
    set({ isLoading: true, error: null })
    try {
      const items = await menuApi.findByPermissions(permissions)
      set({
        items,
        isLoading: false,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch filtered menu'
      set({
        error: message,
        isLoading: false,
      })
    }
  },

  clearMenu: () => {
    set({
      items: [],
      error: null,
    })
  },
}))
