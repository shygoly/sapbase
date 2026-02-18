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
  async findAll(page: number = 1, pageSize: number = 10, search?: string): Promise<PaginatedResponse<User>> {
    const response = await httpClient.get<any>('/api/users', {
      params: {
        page,
        pageSize,
        ...(search && { search }),
      },
    })
    // Backend returns PaginatedResponseDto: { code, message, data: T[], pagination: { page, pageSize, total, totalPages } }
    const responseData = response.data
    if (responseData.pagination) {
      return {
        data: responseData.data || [],
        total: responseData.pagination.total,
        page: responseData.pagination.page,
        limit: responseData.pagination.pageSize,
        totalPages: responseData.pagination.totalPages,
      }
    }
    // Fallback
    return {
      data: Array.isArray(responseData.data) ? responseData.data : [],
      total: responseData.pagination?.total || 0,
      page,
      limit: pageSize,
      totalPages: Math.ceil((responseData.pagination?.total || 0) / pageSize),
    }
  },

  /**
   * Get a specific user by ID
   */
  async findOne(id: string): Promise<User> {
    const response = await httpClient.get<any>(`/api/users/${id}`)
    // Unwrap the response (backend returns { code, message, data: User })
    return response.data.data || response.data
  },

  /**
   * Create a new user
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    const response = await httpClient.post<any>('/api/users', createUserDto)
    // Unwrap the response (backend returns { code, message, data: User })
    return response.data.data || response.data
  },

  /**
   * Update a user
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const response = await httpClient.put<any>(`/api/users/${id}`, updateUserDto)
    // Unwrap the response (backend returns { code, message, data: User })
    return response.data.data || response.data
  },

  /**
   * Delete a user
   */
  async delete(id: string): Promise<void> {
    await httpClient.delete(`/api/users/${id}`)
  },
}
