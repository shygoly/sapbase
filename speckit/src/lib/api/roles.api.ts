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
    const response = await httpClient.get<Role[]>('/api/roles')
    return response.data
  },

  /**
   * Get a specific role by ID
   */
  async findOne(id: string): Promise<Role> {
    const response = await httpClient.get<Role>(`/api/roles/${id}`)
    return response.data
  },

  /**
   * Create a new role
   */
  async create(createRoleDto: CreateRoleInput): Promise<Role> {
    const response = await httpClient.post<Role>('/api/roles', createRoleDto)
    return response.data
  },

  /**
   * Update a role
   */
  async update(id: string, updateRoleDto: UpdateRoleInput): Promise<Role> {
    const response = await httpClient.put<Role>(`/api/roles/${id}`, updateRoleDto)
    return response.data
  },

  /**
   * Delete a role
   */
  async delete(id: string): Promise<void> {
    await httpClient.delete(`/api/roles/${id}`)
  },
}
