/**
 * Users API Service
 * Handles user management endpoints
 */

import { httpClient } from './client'
import { User, PaginatedResponse } from './types'

export interface CreateUserDto {
  name: string
  email: string
  password: string
  role?: string
  department?: string
  status?: 'active' | 'inactive' | 'suspended'
}

export interface UpdateUserDto {
  name?: string
  email?: string
  password?: string
  role?: string
  department?: string
  status?: 'active' | 'inactive' | 'suspended'
  permissions?: string[]
}

export const usersApi = {
  /**
   * Get all users with pagination and search
   */
  async findAll(page: number = 1, pageSize: number = 10, search?: string) {
    const response = await httpClient.get<PaginatedResponse<User>>('/api/users', {
      params: {
        page,
        pageSize,
        ...(search && { search }),
      },
    })
    return response.data
  },

  /**
   * Get a specific user by ID
   */
  async findOne(id: string): Promise<User> {
    const response = await httpClient.get<User>(`/api/users/${id}`)
    return response.data
  },

  /**
   * Create a new user
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    const response = await httpClient.post<User>('/api/users', createUserDto)
    return response.data
  },

  /**
   * Update a user
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const response = await httpClient.put<User>(`/api/users/${id}`, updateUserDto)
    return response.data
  },

  /**
   * Delete a user
   */
  async delete(id: string): Promise<void> {
    await httpClient.delete(`/api/users/${id}`)
  },
}
