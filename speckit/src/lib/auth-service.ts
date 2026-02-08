// Frontend authentication service

const AUTH_TOKEN_KEY = 'auth_token'
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export interface LoginResponse {
  access_token: string
  user: {
    id: string
    name: string
    email: string
    role: string
    permissions: string[]
  }
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  permissions: string[]
}

export class AuthService {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      throw new Error('Login failed')
    }

    const data = await response.json()
    this.setToken(data.access_token)
    return data
  }

  async logout(): Promise<void> {
    const token = this.getToken()
    if (token) {
      try {
        await fetch(`${this.baseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })
      } catch (error) {
        console.error('Logout error:', error)
      }
    }
    this.clearToken()
  }

  async getProfile(): Promise<AuthUser | null> {
    const token = this.getToken()
    if (!token) return null

    try {
      const response = await fetch(`${this.baseUrl}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) return null
      return response.json()
    } catch {
      return null
    }
  }

  getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(AUTH_TOKEN_KEY)
  }

  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_TOKEN_KEY, token)
    }
  }

  clearToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY)
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken()
  }
}

export const authService = new AuthService()
