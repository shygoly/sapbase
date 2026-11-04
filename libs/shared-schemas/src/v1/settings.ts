/**
 * Settings schema definitions
 */

import { BaseAuditEntity } from './common'

export interface SystemSettings extends BaseAuditEntity {
  key: string
  value: string | number | boolean | Record<string, any>
  description?: string
  category?: string
}

export interface SettingsGroup {
  appearance: AppearanceSettings
  localization: LocalizationSettings
  notifications: NotificationSettings
  security: SecuritySettings
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'auto'
  fontSize: number
  language: string
}

export interface LocalizationSettings {
  language: string
  timezone: string
  dateFormat: string
  timeFormat: string
}

export interface NotificationSettings {
  emailNotifications: boolean
  pushNotifications: boolean
  inAppNotifications: boolean
  notificationFrequency: 'immediate' | 'daily' | 'weekly'
}

export interface SecuritySettings {
  sessionTimeout: number
  passwordExpiry: number
  twoFactorEnabled: boolean
  ipWhitelist: string[]
}

export interface CreateSettingsInput {
  key: string
  value: string | number | boolean | Record<string, any>
  description?: string
  category?: string
}

export interface UpdateSettingsInput {
  value?: string | number | boolean | Record<string, any>
  description?: string
  category?: string
}
