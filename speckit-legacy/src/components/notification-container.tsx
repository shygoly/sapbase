'use client'

import { useNotification } from '@/core/notification/hooks'
import { X } from 'lucide-react'

export function NotificationContainer() {
  const { notifications, removeNotification } = useNotification()

  const getBackgroundColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      case 'info':
        return 'bg-blue-50 border-blue-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const getTextColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-green-900'
      case 'error':
        return 'text-red-900'
      case 'warning':
        return 'text-yellow-900'
      case 'info':
        return 'text-blue-900'
      default:
        return 'text-gray-900'
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`border rounded-lg p-4 ${getBackgroundColor(notification.type)} animate-in fade-in slide-in-from-top-2`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className={`font-semibold ${getTextColor(notification.type)}`}>
                {notification.title}
              </h3>
              {notification.message && (
                <p className={`text-sm mt-1 ${getTextColor(notification.type)}`}>
                  {notification.message}
                </p>
              )}
              {notification.action && (
                <button
                  onClick={notification.action.onClick}
                  className={`text-sm font-medium mt-2 underline hover:no-underline ${getTextColor(notification.type)}`}
                >
                  {notification.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className={`ml-4 ${getTextColor(notification.type)} hover:opacity-70`}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
