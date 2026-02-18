/**
 * HTTP Client with interceptors
 * Handles JWT token management, error handling, and request/response transformation
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const TOKEN_KEY = 'access_token'
const USER_KEY = 'user'

class ApiClient {
  private client: AxiosInstance
  private isRefreshing = false
  private failedQueue: Array<{
    onSuccess: (token: string) => void
    onFailed: (error: AxiosError) => void
  }> = []

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // Request interceptor - add token and organization ID to headers
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        // Add organization ID header if available
        const orgId = this.getOrganizationId()
        if (orgId) {
          config.headers['X-Organization-Id'] = orgId
        }
        return config
      },
      (error) => Promise.reject(error),
    )

    // Response interceptor - handle errors and token refresh
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

        // Handle 401 Unauthorized
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({
                onSuccess: (token: string) => {
                  originalRequest.headers.Authorization = `Bearer ${token}`
                  resolve(this.client(originalRequest))
                },
                onFailed: (err) => reject(err),
              })
            })
          }

          this.isRefreshing = true
          originalRequest._retry = true

          // Clear auth
          this.clearAuth()
          
          // Only redirect if not already on login page and not during initial auth check
          if (typeof window !== 'undefined') {
            const currentPath = window.location.pathname
            if (currentPath !== '/login' && !currentPath.startsWith('/login')) {
              // Use a small delay to allow auth store to update first
              setTimeout(() => {
                window.location.href = '/login'
              }, 100)
            }
          }

          return Promise.reject(error)
        }

        // Handle 403 Forbidden
        if (error.response?.status === 403) {
          console.error('Access denied:', error.response.data)
        }

        return Promise.reject(error)
      },
    )
  }

  // Token management
  private getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(TOKEN_KEY)
  }

  private setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token)
    }
  }

  private clearAuth(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem('currentOrganizationId')
      localStorage.removeItem('organizations')
    }
  }

  public setOrganizationId(organizationId: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentOrganizationId', organizationId)
    }
  }

  public getOrganizationId(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('currentOrganizationId')
  }

  // Public methods
  public getClient(): AxiosInstance {
    return this.client
  }

  public setAuthToken(token: string): void {
    this.setToken(token)
  }

  public getAuthToken(): string | null {
    return this.getToken()
  }

  public logout(): void {
    this.clearAuth()
  }

  public isAuthenticated(): boolean {
    return !!this.getToken()
  }
}

export const apiClient = new ApiClient()
export const httpClient = apiClient.getClient()
