/**
 * Menu API Service
 * Handles menu endpoints
 */

import { httpClient } from './client'
import { MenuItem } from './types'

export interface CreateMenuItemDto {
  label: string
  path?: string
  icon?: string
  permissions?: string[]
  visible?: boolean
  order?: number
  parentId?: string
}

export interface UpdateMenuItemDto extends Partial<CreateMenuItemDto> {}

export const menuApi = {
  /**
   * Get all menu items
   */
  async findAll(): Promise<MenuItem[]> {
    const response = await httpClient.get<any>('/api/menu')
    // Unwrap the response (backend returns { code, message, data: MenuItem[] })
    return response.data.data || response.data
  },

  /**
   * Get single menu item
   */
  async findOne(id: string): Promise<MenuItem> {
    const response = await httpClient.get<any>(`/api/menu/${id}`)
    // Unwrap the response (backend returns { code, message, data: MenuItem })
    return response.data.data || response.data
  },

  /**
   * Get menu items filtered by user permissions
   */
  async findByPermissions(permissions: string[]): Promise<MenuItem[]> {
    const response = await httpClient.post<any>('/api/menu/filtered', {
      permissions,
    })
    // Unwrap the response (backend returns { code, message, data: MenuItem[] })
    return response.data.data || response.data
  },

  /**
   * Create a new menu item
   */
  async create(dto: CreateMenuItemDto): Promise<MenuItem> {
    const response = await httpClient.post<any>('/api/menu', dto)
    // Unwrap the response (backend returns { code, message, data: MenuItem })
    return response.data.data || response.data
  },

  /**
   * Update menu item
   */
  async update(id: string, dto: UpdateMenuItemDto): Promise<MenuItem> {
    const response = await httpClient.patch<any>(`/api/menu/${id}`, dto)
    // Unwrap the response (backend returns { code, message, data: MenuItem })
    return response.data.data || response.data
  },

  /**
   * Delete menu item
   */
  async delete(id: string): Promise<void> {
    await httpClient.delete(`/api/menu/${id}`)
  },

  /**
   * Reorder menu items
   */
  async reorder(items: { id: string; order: number }[]): Promise<MenuItem[]> {
    const response = await httpClient.post<any>('/api/menu/reorder', { items })
    // Unwrap the response (backend returns { code, message, data: MenuItem[] })
    return response.data.data || response.data
  },
}
