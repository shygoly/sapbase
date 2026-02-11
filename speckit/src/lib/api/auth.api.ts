/**
 * Auth API Service
 * Handles authentication endpoints
 */

import { httpClient, apiClient } from './client'
import { LoginRequest, LoginResponse, User } from './types'

export const authApi = {
  /**
   * Login with email and password
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await httpClient.post<any>('/api/auth/login', credentials)

    // Unwrap the response (backend returns { code, message, data: { access_token, user } })
    const loginData = response.data.data || response.data

    // Store token and user
    if (loginData.access_token) {
      apiClient.setAuthToken(loginData.access_token)
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(loginData.user))
      }
    }

    return loginData
  },

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      await httpClient.post('/api/auth/logout')
    } finally {
      apiClient.logout()
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user')
      }
    }
  },

  /**
   * Get current user profile
   */
  async getProfile(): Promise<User> {
    const response = await httpClient.post<User>('/api/auth/profile')
    return response.data
  },

  /**
   * Get stored user from localStorage
   */
  getStoredUser(): User | null {
    if (typeof window === 'undefined') return null
    const user = localStorage.getItem('user')
    return user ? JSON.parse(user) : null
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return apiClient.isAuthenticated()
  },
}
