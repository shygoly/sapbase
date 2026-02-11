'use client'

import { useContext, useCallback } from 'react'
import { NotificationContext, type NotificationType } from './context'

export function useNotification() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider')
  }

  const notify = useCallback(
    (type: NotificationType, title: string, message?: string, duration?: number) => {
      return context.addNotification({ type, title, message, duration })
    },
    [context]
  )

  return {
    ...context,
    notify,
    success: (title: string, message?: string) => notify('success', title, message),
    error: (title: string, message?: string) => notify('error', title, message),
    warning: (title: string, message?: string) => notify('warning', title, message),
    info: (title: string, message?: string) => notify('info', title, message),
  }
}
