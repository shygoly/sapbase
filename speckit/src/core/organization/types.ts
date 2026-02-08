// Organization types

export interface Organization {
  id: string
  name: string
  description?: string
  parentId?: string
  level: number
  children?: Organization[]
  createdAt: Date
  updatedAt: Date
}

export interface Department {
  id: string
  name: string
  organizationId: string
  parentId?: string
  level: number
  children?: Department[]
  createdAt: Date
  updatedAt: Date
}

export interface OrganizationContext {
  currentOrganization: Organization | null
  currentDepartment?: Department | null
  organizations: Organization[]
  departments: Department[]
}
