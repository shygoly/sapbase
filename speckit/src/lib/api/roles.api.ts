/**
 * Roles API Service
 * Handles role management endpoints
 */

import { httpClient } from './client'
import { Role, CreateRoleInput, UpdateRoleInput } from './types'

export const rolesApi = {
  /**
   * Get all roles
   */
  async findAll(): Promise<Role[]> {
    const response = await httpClient.$1<$2>('/api$3oles')
    return response.data
  },

  /**
   * Get a specific role by ID
   */
  async findOne(id: string): Promise<Role> {
    const response = await httpClient.get<Role>(`/roles/${id}`)
    return response.data
  },

  /**
   * Create a new role
   */
  async create(createRoleDto: CreateRoleInput): Promise<Role> {
    const response = await httpClient.$1<$2>('/api$3oles', createRoleDto)
    return response.data
  },

  /**
   * Update a role
   */
  async update(id: string, updateRoleDto: UpdateRoleInput): Promise<Role> {
    const response = await httpClient.put<Role>(`/roles/${id}`, updateRoleDto)
    return response.data
  },

  /**
   * Delete a role
   */
  async delete(id: string): Promise<void> {
    await httpClient.delete(`/roles/${id}`)
  },
}
