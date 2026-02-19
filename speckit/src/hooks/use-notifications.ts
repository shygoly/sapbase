'use client'

import { useState, useCallback } from 'react'
import { useWebSocket } from './use-websocket'
import type { Notification } from '@/lib/websocket/websocket-client'

interface UseNotificationsOptions {
  autoConnect?: boolean
}

/**
 * React hook for managing real-time notifications.
 * 
 * Usage:
 * ```tsx
 * const { notifications, unreadCount, markAsRead } = useNotifications()
 * ```
 */
export function useNotifications(options: UseNotificationsOptions = {}) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const handleNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => [notification, ...prev])
    if (!notification.read) {
      setUnreadCount((prev) => prev + 1)
    }
  }, [])

  const { client, connected } = useWebSocket({
    autoConnect: options.autoConnect ?? true,
    onNotification: handleNotification,
  })

  const markAsRead = useCallback(
    (notificationId: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
      client?.markNotificationRead(notificationId)
    },
    [client],
  )

  const markAllAsRead = useCallback(() => {
    notifications.forEach((n) => {
      if (!n.read) {
        client?.markNotificationRead(n.id)
      }
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [notifications, client])

  const removeNotification = useCallback((notificationId: string) => {
    setNotifications((prev) => {
      const notification = prev.find((n) => n.id === notificationId)
      if (notification && !notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
      return prev.filter((n) => n.id !== notificationId)
    })
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    setUnreadCount(0)
  }, [])

  return {
    notifications,
    unreadCount,
    connected,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  }
}
