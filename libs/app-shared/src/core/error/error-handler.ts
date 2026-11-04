/**
 * Error Handler
 * Centralized error handling and user-friendly error messages
 */

import axios, { AxiosError } from 'axios'

export interface ApiError {
  status: number
  message: string
  details?: Record<string, any>
}

export function handleApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>

    // Handle specific status codes
    switch (axiosError.response?.status) {
      case 400:
        return {
          status: 400,
          message: axiosError.response?.data?.message || 'Invalid request',
          details: axiosError.response?.data?.details,
        }
      case 401:
        return {
          status: 401,
          message: 'Unauthorized. Please login again.',
        }
      case 403:
        return {
          status: 403,
          message: 'You do not have permission to perform this action.',
        }
      case 404:
        return {
          status: 404,
          message: 'Resource not found.',
        }
      case 409:
        return {
          status: 409,
          message: axiosError.response?.data?.message || 'Conflict. Resource already exists.',
        }
      case 422:
        return {
          status: 422,
          message: 'Validation error.',
          details: axiosError.response?.data?.details,
        }
      case 500:
        return {
          status: 500,
          message: 'Server error. Please try again later.',
        }
      default:
        return {
          status: axiosError.response?.status || 500,
          message: axiosError.response?.data?.message || 'An error occurred',
        }
    }
  }

  if (error instanceof Error) {
    return {
      status: 500,
      message: error.message,
    }
  }

  return {
    status: 500,
    message: 'An unexpected error occurred',
  }
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  const apiError = handleApiError(error)
  return apiError.message
}
