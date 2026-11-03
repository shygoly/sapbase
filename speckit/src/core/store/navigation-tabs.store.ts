import { create } from 'zustand'

interface NavigationTab {
  path: string
  label: string
  icon?: string
  closable: boolean
}

interface NavigationTabsState {
  tabs: NavigationTab[]
  activePath: string
  hydrated: boolean
  hydrate: () => void
  openTab: (tab: Omit<NavigationTab, 'closable'> & { closable?: boolean }) => void
  activateTab: (path: string) => void
  closeTab: (path: string) => string | null
  closeOtherTabs: (path: string) => void
}

const STORAGE_KEY = 'shipping-carbon-navigation-tabs'

function persistTabs(tabs: NavigationTab[], activePath: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activePath }))
}

export const useNavigationTabsStore = create<NavigationTabsState>((set, get) => ({
  tabs: [],
  activePath: '',
  hydrated: false,

  hydrate: () => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        set({ hydrated: true })
        return
      }
      const parsed = JSON.parse(raw) as { tabs?: NavigationTab[]; activePath?: string }
      set({
        tabs: parsed.tabs ?? [],
        activePath: parsed.activePath ?? '',
        hydrated: true,
      })
    } catch {
      set({ hydrated: true })
    }
  },

  openTab: ({ path, label, icon, closable = true }) => {
    const existing = get().tabs.find((tab) => tab.path === path)
    const tabs = existing
      ? get().tabs.map((tab) => (tab.path === path ? { ...tab, label, icon } : tab))
      : [...get().tabs, { path, label, icon, closable }]

    set({ tabs, activePath: path })
    persistTabs(tabs, path)
  },

  activateTab: (path) => {
    set({ activePath: path })
    persistTabs(get().tabs, path)
  },

  closeTab: (path) => {
    const { tabs, activePath } = get()
    const closingIndex = tabs.findIndex((tab) => tab.path === path)
    if (closingIndex === -1) return activePath || null

    const nextTabs = tabs.filter((tab) => tab.path !== path)
    let nextActivePath = activePath

    if (activePath === path) {
      const nextCandidate = nextTabs[closingIndex] ?? nextTabs[closingIndex - 1] ?? nextTabs[0]
      nextActivePath = nextCandidate?.path ?? ''
    }

    set({ tabs: nextTabs, activePath: nextActivePath })
    persistTabs(nextTabs, nextActivePath)
    return nextActivePath || null
  },

  closeOtherTabs: (path) => {
    const current = get().tabs.find((tab) => tab.path === path)
    if (!current) return
    const tabs = [current]
    set({ tabs, activePath: path })
    persistTabs(tabs, path)
  },
}))

export type { NavigationTab }
