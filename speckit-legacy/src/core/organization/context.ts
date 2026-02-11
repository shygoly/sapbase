import { createContext, useContext } from 'react'
import type { OrganizationContext as OrganizationContextState } from './types'

export interface OrganizationContextType extends OrganizationContextState {
  switchOrganization: (organizationId: string) => Promise<void>
  switchDepartment: (departmentId: string) => Promise<void>
  loadOrganizations: () => Promise<void>
  loadDepartments: (organizationId: string) => Promise<void>
}

export const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function useOrganization(): OrganizationContextType {
  const context = useContext(OrganizationContext)
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider')
  }
  return context
}
