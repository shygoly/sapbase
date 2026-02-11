'use client'

import React, { createContext, useState, useCallback, ReactNode } from 'react'

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

export interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id'>) => string
  removeNotification: (id: string) => void
  clearNotifications: () => void
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

interface NotificationProviderProps {
  children: ReactNode
  maxNotifications?: number
}

export function NotificationProvider({ children, maxNotifications = 10 }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = useCallback(
    (notification: Omit<Notification, 'id'>) => {
      const id = `${Date.now()}-${Math.random()}`
      const newNotification: Notification = {
        ...notification,
        id,
        duration: notification.duration || 5000,
      }

      setNotifications((prev) => {
        const updated = [newNotification, ...prev]
        return updated.slice(0, maxNotifications)
      })

      // Auto-remove after duration
      if (newNotification.duration && newNotification.duration > 0) {
        setTimeout(() => {
          removeNotification(id)
        }, newNotification.duration)
      }

      return id
    },
    [maxNotifications]
  )

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  return React.createElement(
    NotificationContext.Provider,
    { value: { notifications, addNotification, removeNotification, clearNotifications } },
    children
  )
}
