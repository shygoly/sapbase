// Page Model types

export type PageType = 'list' | 'form' | 'detail' | 'dashboard'

export interface PageMetadata {
  title: string
  description?: string
  icon?: string
  breadcrumbs?: string[]
}

export interface PageSchema {
  path: string
  type: PageType
  metadata: PageMetadata
  permissions?: string[]
  layout?: string
}

export interface PageState {
  currentPage: PageSchema | null
  isLoading: boolean
  error: string | null
}

export interface PageLifecycleHooks {
  onBeforeLoad?: () => Promise<void>
  onAfterLoad?: () => Promise<void>
  onBeforeUnload?: () => Promise<void>
  onAfterUnload?: () => Promise<void>
}

export interface PageModel {
  id: string
  title: string
  description?: string
  icon?: string
  type: PageType
  path: string
  permissions?: string[]
  layout?: string
  metadata?: PageMetadata
  hooks?: PageLifecycleHooks
}
