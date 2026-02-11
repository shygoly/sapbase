// Navigation types

export interface MenuItem {
  id: string
  label: string
  path?: string
  icon?: string
  permission?: string
  children?: MenuItem[]
  order: number
  visible: boolean
}

export interface NavigationState {
  menu: MenuItem[]
  breadcrumbs: BreadcrumbItem[]
  currentPath: string
}

export interface BreadcrumbItem {
  label: string
  path: string
}

export interface MenuResolverOptions {
  permissions: string[]
  organizationId: string
}
