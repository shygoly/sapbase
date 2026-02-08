// Environment configuration

export const isDevelopment = process.env.NODE_ENV === 'development'
export const isProduction = process.env.NODE_ENV === 'production'
export const isTest = process.env.NODE_ENV === 'test'

export const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
export const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const enableDebugLogging = isDevelopment || process.env.NEXT_PUBLIC_DEBUG === 'true'
export const enableErrorReporting = isProduction && !!process.env.NEXT_PUBLIC_ERROR_REPORTING_URL

export const config = {
  isDevelopment,
  isProduction,
  isTest,
  apiUrl,
  appUrl,
  enableDebugLogging,
  enableErrorReporting,
}
