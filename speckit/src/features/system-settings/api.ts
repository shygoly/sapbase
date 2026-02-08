// System settings API client

export interface SystemSettings {
  id: string
  theme: 'light' | 'dark'
  language: string
  timezone: string
  dateFormat: string
  timeFormat: string
  pageSize: number
  fontSize: number
  enableNotifications: boolean
}

export const settingsApi = {
  async getSettings(): Promise<SystemSettings> {
    return {
      id: '1',
      theme: 'light',
      language: 'en',
      timezone: 'UTC',
      dateFormat: 'MM/DD/YYYY',
      timeFormat: '24h',
      pageSize: 20,
      fontSize: 14,
      enableNotifications: true,
    }
  },

  async updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    return { ...settings } as SystemSettings
  },
}
