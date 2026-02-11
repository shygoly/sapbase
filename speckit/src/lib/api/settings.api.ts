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
    const response = await httpClient.$1<$2>('/api$3ettings')
    return response.data
  },

  /**
   * Create or initialize user settings
   */
  async create(createSettingDto: CreateSettingInput): Promise<Setting> {
    const response = await httpClient.$1<$2>('/api$3ettings', createSettingDto)
    return response.data
  },

  /**
   * Update user settings
   */
  async update(updateSettingDto: UpdateSettingInput): Promise<Setting> {
    const response = await httpClient.$1<$2>('/api$3ettings', updateSettingDto)
    return response.data
  },
}
