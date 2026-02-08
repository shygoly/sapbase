// Role management API client

import { apiService } from '@/lib/api-service'

export interface Role {
  id: string
  name: string
  permissions: string[]
  description?: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateRoleInput {
  name: string
  permissions: string[]
  description?: string
}

export interface UpdateRoleInput {
  name?: string
  permissions?: string[]
  description?: string
}

export const roleApi = {
  async getRoles(): Promise<Role[]> {
    return apiService.getRoles()
  },

  async getRole(id: string): Promise<Role> {
    return apiService.getRole(id)
  },

  async createRole(input: CreateRoleInput): Promise<Role> {
    return apiService.createRole(input)
  },

  async updateRole(id: string, input: UpdateRoleInput): Promise<Role> {
    return apiService.updateRole(id, input)
  },

  async deleteRole(id: string): Promise<void> {
    return apiService.deleteRole(id)
  },
}
