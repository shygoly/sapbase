// Centralized type exports

// i18n types
export type { Language } from '@/core/i18n/config'
export type { I18nContextType } from '@/core/i18n/context'

// Theme types
export type { Theme, ThemeColors, ThemeConfig, ThemeContextType } from '@/core/theme/types'

// Error types
export type { ErrorLog, ErrorContextType } from '@/core/error/context'

// Notification types
export type { NotificationType, Notification, NotificationContextType } from '@/core/notification/context'

// Menu types
export type { MenuItem, MenuConfig } from '@/core/menu/config'
export type { MenuContextType } from '@/core/menu/context'

// Hook types
export type { FormErrors } from '@/lib/hooks/use-form'
export type { UseFetchOptions } from '@/lib/hooks/use-fetch'
export type { AsyncState } from '@/lib/hooks/use-async'
