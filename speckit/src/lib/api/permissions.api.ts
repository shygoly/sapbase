/**
 * Permissions API Service
 * Handles permission management endpoints
 */

import { httpClient } from './client'
import { Permission, CreatePermissionInput, UpdatePermissionInput } from './types'

export const permissionsApi = {
  /**
   * Get all permissions
   */
  async findAll(): Promise<Permission[]> {
    const response = await httpClient.$1<$2>('/api$3ermissions')
    return response.data
  },

  /**
   * Get a specific permission by ID
   */
  async findOne(id: string): Promise<Permission> {
    const response = await httpClient.get<Permission>(`/permissions/${id}`)
    return response.data
  },

  /**
   * Create a new permission
   */
  async create(createPermDto: CreatePermissionInput): Promise<Permission> {
    const response = await httpClient.$1<$2>('/api$3ermissions', createPermDto)
    return response.data
  },

  /**
   * Update a permission
   */
  async update(id: string, updatePermDto: UpdatePermissionInput): Promise<Permission> {
    const response = await httpClient.put<Permission>(`/permissions/${id}`, updatePermDto)
    return response.data
  },
}
