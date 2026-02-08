// User management API client

import { apiService } from '@/lib/api-service'

export interface User {
  id: string
  name: string
  email: string
  role: string
  department?: string
  status: 'active' | 'inactive'
  createdAt: Date
  updatedAt: Date
}

export interface CreateUserInput {
  name: string
  email: string
  role: string
  department?: string
}

export interface UpdateUserInput {
  name?: string
  email?: string
  role?: string
  department?: string
  status?: 'active' | 'inactive'
}

export const userApi = {
  async getUsers(): Promise<User[]> {
    return apiService.getUsers()
  },

  async getUser(id: string): Promise<User> {
    return apiService.getUser(id)
  },

  async createUser(input: CreateUserInput): Promise<User> {
    return apiService.createUser(input)
  },

  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    return apiService.updateUser(id, input)
  },

  async deleteUser(id: string): Promise<void> {
    return apiService.deleteUser(id)
  },
}
