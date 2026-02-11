export interface UnifiedMenuItem {
  id: string
  label: string
  path?: string
  icon?: string
  permissions?: string[]
  visible: boolean
  order: number
  children?: UnifiedMenuItem[]
  isActive?: boolean
  shortcut?: [string, string]
}

export interface MenuSource {
  type: 'static' | 'api'
  items: UnifiedMenuItem[]
}

export interface MenuState {
  items: UnifiedMenuItem[]
  loading: boolean
  error: string | null
  expandedItems: Set<string>
}
