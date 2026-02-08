'use client'

import React, { createContext, useState, useCallback, ReactNode } from 'react'

export interface ErrorLog {
  id: string
  timestamp: number
  message: string
  stack?: string
  context?: Record<string, any>
  severity: 'error' | 'warning' | 'info'
}

export interface ErrorContextType {
  errors: ErrorLog[]
  addError: (message: string, options?: { stack?: string; context?: Record<string, any>; severity?: 'error' | 'warning' | 'info' }) => void
  clearErrors: () => void
  removeError: (id: string) => void
}

export const ErrorContext = createContext<ErrorContextType | undefined>(undefined)

interface ErrorProviderProps {
  children: ReactNode
  maxErrors?: number
}

export function ErrorProvider(props: ErrorProviderProps) {
  const { maxErrors = 50 } = props
  const [errors, setErrors] = useState<ErrorLog[]>([])

  const addError = useCallback((message: string, options?: { stack?: string; context?: Record<string, any>; severity?: 'error' | 'warning' | 'info' }) => {
    const error: ErrorLog = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      message,
      stack: options?.stack,
      context: options?.context,
      severity: options?.severity || 'error',
    }

    setErrors((prev) => {
      const updated = [error, ...prev]
      return updated.slice(0, maxErrors)
    })

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${error.severity.toUpperCase()}]`, message, error)
    }
  }, [maxErrors])

  const clearErrors = useCallback(() => {
    setErrors([])
  }, [])

  const removeError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return React.createElement(
    ErrorContext.Provider,
    { value: { errors, addError, clearErrors, removeError } },
    props.children
  )
}
