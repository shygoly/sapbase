// Core authentication and permission types

export interface User {
  id: string
  name: string
  email: string
  role: string
  permissions: string[]
  organizationId: string
  departmentId?: string
  dataScope: 'all' | 'organization' | 'department' | 'self'
  avatar?: string
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  user: User
  token: string
  expiresAt: Date
  refreshToken?: string
}

export interface Permission {
  id: string
  name: string
  description: string
  resource: string
  action: string
}

export interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  organizationId: string
}

export interface AuthState {
  user: User | null
  session: Session | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
  session: Session
}
