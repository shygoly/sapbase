import { create } from 'zustand'

export interface UIState {
  modals: Record<string, boolean>
  sidebars: Record<string, boolean>
  loadingStates: Record<string, boolean>
  notifications: Array<{
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    message: string
    timestamp: number
  }>
  theme: 'light' | 'dark'
  sidebarCollapsed: boolean
}

export interface UIStoreState {
  ui: UIState

  // Modal actions
  openModal: (modalId: string) => void
  closeModal: (modalId: string) => void
  toggleModal: (modalId: string) => void
  isModalOpen: (modalId: string) => boolean

  // Sidebar actions
  openSidebar: (sidebarId: string) => void
  closeSidebar: (sidebarId: string) => void
  toggleSidebar: (sidebarId: string) => void
  toggleMainSidebar: () => void

  // Loading actions
  setLoading: (key: string, loading: boolean) => void
  isLoading: (key: string) => boolean

  // Theme actions
  setTheme: (theme: 'light' | 'dark') => void

  // Notification actions
  addNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void

  // Reset
  reset: () => void
}

const initialUIState: UIState = {
  modals: {},
  sidebars: {},
  loadingStates: {},
  notifications: [],
  theme: 'light',
  sidebarCollapsed: false,
}

export const useUIStore = create<UIStoreState>((set, get) => ({
  ui: initialUIState,

  openModal: (modalId) =>
    set((state) => ({
      ui: { ...state.ui, modals: { ...state.ui.modals, [modalId]: true } },
    })),

  closeModal: (modalId) =>
    set((state) => ({
      ui: { ...state.ui, modals: { ...state.ui.modals, [modalId]: false } },
    })),

  toggleModal: (modalId) =>
    set((state) => ({
      ui: {
        ...state.ui,
        modals: { ...state.ui.modals, [modalId]: !state.ui.modals[modalId] },
      },
    })),

  isModalOpen: (modalId) => get().ui.modals[modalId] || false,

  openSidebar: (sidebarId) =>
    set((state) => ({
      ui: { ...state.ui, sidebars: { ...state.ui.sidebars, [sidebarId]: true } },
    })),

  closeSidebar: (sidebarId) =>
    set((state) => ({
      ui: { ...state.ui, sidebars: { ...state.ui.sidebars, [sidebarId]: false } },
    })),

  toggleSidebar: (sidebarId) =>
    set((state) => ({
      ui: {
        ...state.ui,
        sidebars: { ...state.ui.sidebars, [sidebarId]: !state.ui.sidebars[sidebarId] },
      },
    })),

  toggleMainSidebar: () =>
    set((state) => ({
      ui: { ...state.ui, sidebarCollapsed: !state.ui.sidebarCollapsed },
    })),

  setLoading: (key, loading) =>
    set((state) => ({
      ui: { ...state.ui, loadingStates: { ...state.ui.loadingStates, [key]: loading } },
    })),

  isLoading: (key) => get().ui.loadingStates[key] || false,

  setTheme: (theme) =>
    set((state) => ({
      ui: { ...state.ui, theme },
    })),

  addNotification: (type, message) =>
    set((state) => ({
      ui: {
        ...state.ui,
        notifications: [
          ...state.ui.notifications,
          {
            id: `${Date.now()}-${Math.random()}`,
            type,
            message,
            timestamp: Date.now(),
          },
        ],
      },
    })),

  removeNotification: (id) =>
    set((state) => ({
      ui: {
        ...state.ui,
        notifications: state.ui.notifications.filter((n) => n.id !== id),
      },
    })),

  clearNotifications: () =>
    set((state) => ({
      ui: { ...state.ui, notifications: [] },
    })),

  reset: () =>
    set({
      ui: initialUIState,
    }),
}))
