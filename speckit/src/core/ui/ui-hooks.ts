/**
 * UI Hooks
 * Custom hooks for UI state management
 */

import { useUIStore } from '@/core/store'
import { toast } from 'sonner'

/**
 * useNotification - Add notifications
 */
export function useNotification() {
  const { addNotification, removeNotification, clearNotifications } = useUIStore()

  return {
    success: (message: string, duration?: number) => {
      toast.success(message, { duration })
      addNotification({ type: 'success', message, duration })
    },
    error: (message: string, duration?: number) => {
      toast.error(message, { duration })
      addNotification({ type: 'error', message, duration })
    },
    warning: (message: string, duration?: number) => {
      toast.warning(message, { duration })
      addNotification({ type: 'warning', message, duration })
    },
    info: (message: string, duration?: number) => {
      toast.info(message, { duration })
      addNotification({ type: 'info', message, duration })
    },
    remove: removeNotification,
    clear: clearNotifications,
  }
}

/**
 * useSidebar - Sidebar state
 */
export function useSidebar() {
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore()
  return { sidebarOpen, toggleSidebar, setSidebarOpen }
}

/**
 * useTheme - Theme state
 */
export function useTheme() {
  const { theme, setTheme } = useUIStore()
  return { theme, setTheme }
}

/**
 * useNotifications - Get all notifications
 */
export function useNotifications() {
  const { notifications } = useUIStore()
  return notifications
}
