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
    const response = await httpClient.$1<$2>('/api$3enu')
    return response.data
  },

  /**
   * Get single menu item
   */
  async findOne(id: string): Promise<MenuItem> {
    const response = await httpClient.get<MenuItem>(`/menu/${id}`)
    return response.data
  },

  /**
   * Get menu items filtered by user permissions
   */
  async findByPermissions(permissions: string[]): Promise<MenuItem[]> {
    const response = await httpClient.$1<$2>('/api$3enu/filtered', {
      permissions,
    })
    return response.data
  },

  /**
   * Create a new menu item
   */
  async create(dto: CreateMenuItemDto): Promise<MenuItem> {
    const response = await httpClient.$1<$2>('/api$3enu', dto)
    return response.data
  },

  /**
   * Update menu item
   */
  async update(id: string, dto: UpdateMenuItemDto): Promise<MenuItem> {
    const response = await httpClient.patch<MenuItem>(`/menu/${id}`, dto)
    return response.data
  },

  /**
   * Delete menu item
   */
  async delete(id: string): Promise<void> {
    await httpClient.delete(`/menu/${id}`)
  },

  /**
   * Reorder menu items
   */
  async reorder(items: { id: string; order: number }[]): Promise<MenuItem[]> {
    const response = await httpClient.$1<$2>('/api$3enu/reorder', { items })
    return response.data
  },
}
