export interface UnifiedMenuItem {
  id: string
  label: string
  path?: string
  icon?: string
  permissions?: string[]
  visible?: boolean // Optional, defaults to true
  disabled?: boolean // Optional, defaults to false
  order: number
  children?: UnifiedMenuItem[]
  isActive?: boolean
  shortcut?: [string, string]
  /** 台面：portal / console / both；缺省 both。 */
  surface?: 'portal' | 'console' | 'both'
  /** Runtime 组件键白名单；未知值回退默认组件。 */
  componentKey?: string
  /** 交互标识（pagination/confirm/draft/virtualization）。 */
  interaction?: Record<string, unknown>
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
