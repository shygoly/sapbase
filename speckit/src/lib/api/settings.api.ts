/**
 * Settings API Service
 * Handles user settings endpoints
 */

import { httpClient } from './client'
import { Setting, CreateSettingInput, UpdateSettingInput } from './types'

export const settingsApi = {
  /**
   * Get current user settings
   */
  async findByUserId(): Promise<Setting[]> {
    const response = await httpClient.get<Setting[]>('/api/settings')
    return response.data
  },

  /**
   * Create or initialize user settings
   */
  async create(createSettingDto: CreateSettingInput): Promise<Setting> {
    const response = await httpClient.post<Setting>('/api/settings', createSettingDto)
    return response.data
  },

  /**
   * Update user settings
   */
  async update(updateSettingDto: UpdateSettingInput): Promise<Setting> {
    const response = await httpClient.put<Setting>('/api/settings', updateSettingDto)
    return response.data
  },
}
