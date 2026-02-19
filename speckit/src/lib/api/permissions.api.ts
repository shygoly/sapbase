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
    const response = await httpClient.get<any>('/api/permissions')
    // Unwrap the response (backend returns { code, message, data: Permission[] })
    return response.data.data || response.data
  },

  /**
   * Get a specific permission by ID
   */
  async findOne(id: string): Promise<Permission> {
    const response = await httpClient.get<any>(`/api/permissions/${id}`)
    // Unwrap the response (backend returns { code, message, data: Permission })
    return response.data.data || response.data
  },

  /**
   * Create a new permission
   */
  async create(createPermDto: CreatePermissionInput): Promise<Permission> {
    const response = await httpClient.post<any>('/api/permissions', createPermDto)
    // Unwrap the response (backend returns { code, message, data: Permission })
    return response.data.data || response.data
  },

  /**
   * Update a permission
   */
  async update(id: string, updatePermDto: UpdatePermissionInput): Promise<Permission> {
    const response = await httpClient.put<any>(`/api/permissions/${id}`, updatePermDto)
    // Unwrap the response (backend returns { code, message, data: Permission })
    return response.data.data || response.data
  },
}
