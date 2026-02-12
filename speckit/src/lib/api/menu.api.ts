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
    const response = await httpClient.get<MenuItem[]>('/api/menu')
    return response.data
  },

  /**
   * Get single menu item
   */
  async findOne(id: string): Promise<MenuItem> {
    const response = await httpClient.get<MenuItem>(`/api/menu/${id}`)
    return response.data
  },

  /**
   * Get menu items filtered by user permissions
   */
  async findByPermissions(permissions: string[]): Promise<MenuItem[]> {
    const response = await httpClient.post<MenuItem[]>('/api/menu/filtered', {
      permissions,
    })
    return response.data
  },

  /**
   * Create a new menu item
   */
  async create(dto: CreateMenuItemDto): Promise<MenuItem> {
    const response = await httpClient.post<MenuItem>('/api/menu', dto)
    return response.data
  },

  /**
   * Update menu item
   */
  async update(id: string, dto: UpdateMenuItemDto): Promise<MenuItem> {
    const response = await httpClient.patch<MenuItem>(`/api/menu/${id}`, dto)
    return response.data
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
    const response = await httpClient.post<MenuItem[]>('/api/menu/reorder', { items })
    return response.data
  },
}
