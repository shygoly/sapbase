/**
 * User schema definitions
 */

import { BaseAuditEntity, UserStatus } from './common'

export interface User extends BaseAuditEntity {
  name: string
  email: string
  role: string
  status: UserStatus
  department?: string
  permissions: string[]
}

export interface UserEntity extends User {
  passwordHash?: string
}

export interface CreateUserInput {
  name: string
  email: string
  password: string
  role?: string
  department?: string
  status?: UserStatus
}

export interface UpdateUserInput {
  name?: string
  email?: string
  password?: string
  role?: string
  department?: string
  status?: UserStatus
  permissions?: string[]
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  user: User
}

export interface AuthUser extends User {
  permissions: string[]
}
