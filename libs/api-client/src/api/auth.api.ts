/**
 * Auth API Service
 * Handles authentication endpoints
 */

import { httpClient, apiClient } from './client'
import { LoginRequest, LoginResponse, User } from './types'
import { Organization } from './organizations.api'

export interface LoginResponseWithOrgs extends LoginResponse {
  organizations?: Organization[]
  currentOrganizationId?: string
}

export interface SsoProvider {
  key: string
  name: string
  type: 'cas' | 'oauth2' | 'oidc' | 'saml'
}

export interface SsoCallbackInput {
  organizationId: string
  ticket?: string
  samlResponse?: string
  code?: string
  codeVerifier?: string
  state?: string
  nonce?: string
}

function unwrapResponse<T>(response: { data: unknown }): T {
  const body = response.data as Record<string, unknown> | T
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: T }).data
  return body as T
}

export const authApi = {
  /**
   * Login with email and password
   */
  async login(credentials: LoginRequest & { organizationId?: string }): Promise<LoginResponseWithOrgs> {
    const response = await httpClient.post<any>('/api/auth/login', credentials)

    // Unwrap the response (backend returns { code, message, data: { access_token, user, organizations, currentOrganizationId } })
    const loginData = response.data.data || response.data

    // Store token and user
    if (loginData.access_token) {
      apiClient.setAuthToken(loginData.access_token)
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(loginData.user))
        if (loginData.currentOrganizationId) {
          localStorage.setItem('currentOrganizationId', loginData.currentOrganizationId)
        }
        if (loginData.organizations) {
          localStorage.setItem('organizations', JSON.stringify(loginData.organizations))
        }
      }
    }

    return loginData
  },

  async ssoProviders(organizationId: string): Promise<SsoProvider[]> {
    const result = unwrapResponse<{ providers?: SsoProvider[] }>(
      await httpClient.get(
        `/api/identity/sso/providers?organizationId=${encodeURIComponent(organizationId)}`,
      ),
    )
    return result.providers ?? []
  },

  async ssoAuthorize(
    organizationId: string,
    providerKey: string,
    input: { state?: string; nonce?: string; codeChallenge?: string } = {},
  ): Promise<{ url: string }> {
    const params = new URLSearchParams({ organizationId })
    if (input.state) params.set('state', input.state)
    if (input.nonce) params.set('nonce', input.nonce)
    if (input.codeChallenge) params.set('codeChallenge', input.codeChallenge)
    return unwrapResponse<{ url: string }>(
      await httpClient.get(
        `/api/identity/sso/${encodeURIComponent(providerKey)}/authorize?${params.toString()}`,
      ),
    )
  },

  async ssoCallback(
    providerKey: string,
    input: SsoCallbackInput,
  ): Promise<LoginResponseWithOrgs> {
    const response = await httpClient.post<any>(
      `/api/auth/sso/${encodeURIComponent(providerKey)}/callback?organizationId=${encodeURIComponent(input.organizationId)}`,
      input,
    )
    const loginData = unwrapResponse<LoginResponseWithOrgs>(response)
    if (loginData.access_token) {
      apiClient.setAuthToken(loginData.access_token)
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(loginData.user))
        if (loginData.currentOrganizationId) {
          localStorage.setItem('currentOrganizationId', loginData.currentOrganizationId)
        }
        if (loginData.organizations) {
          localStorage.setItem('organizations', JSON.stringify(loginData.organizations))
        }
      }
    }
    return loginData
  },

  /**
   * Switch organization context
   */
  async switchOrganization(organizationId: string): Promise<{ access_token: string }> {
    const response = await httpClient.post<any>('/api/auth/switch-organization', { organizationId })
    const data = response.data.data || response.data

    if (data.access_token) {
      apiClient.setAuthToken(data.access_token)
      if (typeof window !== 'undefined') {
        localStorage.setItem('currentOrganizationId', organizationId)
      }
    }

    return data
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
    const response = await httpClient.post<any>('/api/auth/profile')
    // Unwrap the response (backend returns { code, message, data: User })
    const userData = response.data.data || response.data
    // Update stored user if profile fetch succeeds
    if (typeof window !== 'undefined' && userData) {
      localStorage.setItem('user', JSON.stringify(userData))
    }
    return userData
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
