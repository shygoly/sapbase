'use client'

import { useState, useCallback } from 'react'
import { useNotification } from '@/core/notification/hooks'

export interface FormErrors {
  [key: string]: string
}

export function useForm<T extends Record<string, any>>(
  initialValues: T,
  onSubmit: (values: T) => Promise<void>,
  validate?: (values: T) => FormErrors
) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const { success, error: notifyError } = useNotification()

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target
      const fieldValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value

      setValues((prev) => ({
        ...prev,
        [name]: fieldValue,
      }))

      // Clear error for this field
      if (errors[name]) {
        setErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors[name]
          return newErrors
        })
      }
    },
    [errors]
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      // Validate
      if (validate) {
        const newErrors = validate(values)
        if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors)
          return
        }
      }

      setLoading(true)
      try {
        await onSubmit(values)
        success('Success', 'Form submitted successfully')
        setValues(initialValues)
        setErrors({})
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to submit form'
        notifyError('Error', message)
      } finally {
        setLoading(false)
      }
    },
    [values, validate, onSubmit, initialValues, success, notifyError]
  )

  const reset = useCallback(() => {
    setValues(initialValues)
    setErrors({})
  }, [initialValues])

  return {
    values,
    errors,
    loading,
    handleChange,
    handleSubmit,
    reset,
    setValues,
    setErrors,
  }
}
