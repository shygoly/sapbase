/**
 * Department schema definitions
 */

import { BaseAuditEntity, EntityStatus } from './common'

export interface Department extends BaseAuditEntity {
  name: string
  description?: string
  managerId?: string
  status: EntityStatus
}

export interface CreateDepartmentInput {
  name: string
  description?: string
  managerId?: string
  status?: EntityStatus
}

export interface UpdateDepartmentInput {
  name?: string
  description?: string
  managerId?: string
  status?: EntityStatus
}
