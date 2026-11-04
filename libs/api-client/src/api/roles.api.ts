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
    const response = await httpClient.get<any>('/api/roles')
    // Unwrap the response (backend returns { code, message, data: Role[] })
    return response.data.data || response.data
  },

  /**
   * Get a specific role by ID
   */
  async findOne(id: string): Promise<Role> {
    const response = await httpClient.get<any>(`/api/roles/${id}`)
    // Unwrap the response (backend returns { code, message, data: Role })
    return response.data.data || response.data
  },

  /**
   * Create a new role
   */
  async create(createRoleDto: CreateRoleInput): Promise<Role> {
    const response = await httpClient.post<any>('/api/roles', createRoleDto)
    // Unwrap the response (backend returns { code, message, data: Role })
    return response.data.data || response.data
  },

  /**
   * Update a role
   */
  async update(id: string, updateRoleDto: UpdateRoleInput): Promise<Role> {
    const response = await httpClient.put<any>(`/api/roles/${id}`, updateRoleDto)
    // Unwrap the response (backend returns { code, message, data: Role })
    return response.data.data || response.data
  },

  /**
   * Delete a role
   */
  async delete(id: string): Promise<void> {
    await httpClient.delete(`/api/roles/${id}`)
  },
}
