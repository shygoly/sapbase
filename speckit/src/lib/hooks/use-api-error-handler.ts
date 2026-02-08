'use client'

import { useNotification } from '@/core/notification/hooks'
import { useError } from '@/core/error/hooks'

export function useApiErrorHandler() {
  const { error: notifyError } = useNotification()
  const { addError } = useError()

  const handleError = (err: unknown, defaultMessage: string = 'An error occurred') => {
    let message = defaultMessage
    let details: string | undefined

    if (err instanceof Error) {
      message = err.message || defaultMessage
      details = err.stack
    } else if (typeof err === 'string') {
      message = err
    }

    addError(message, { stack: details, severity: 'error' })
    notifyError('Error', message)
  }

  const handleApiError = (status: number, message?: string) => {
    const errorMessages: Record<number, string> = {
      400: 'Bad request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not found',
      500: 'Server error',
      503: 'Service unavailable',
    }

    const errorMsg = message || errorMessages[status] || 'An error occurred'
    handleError(new Error(errorMsg))
  }

  return { handleError, handleApiError }
}
