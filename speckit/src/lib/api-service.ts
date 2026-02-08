// API service for communicating with NestJS backend

import { authService } from './auth-service'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export interface ApiResponse<T> {
  data: T
  status: number
  message?: string
}

export class ApiService {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const token = authService.getToken()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (options.headers) {
      Object.assign(headers, options.headers)
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(url, {
      headers,
      ...options,
    })

    if (response.status === 401) {
      authService.clearToken()
      throw new Error('Unauthorized')
    }

    if (!response.ok) {
      try {
        const errorData = await response.json()
        throw new Error(errorData.message || `API Error: ${response.status}`)
      } catch (e) {
        if (e instanceof Error) throw e
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null as T
    }

    return response.json()
  }

  // Users endpoints
  async getUsers<T = any>(): Promise<T[]> {
    return this.request<T[]>('/users')
  }

  async getUser<T = any>(id: string): Promise<T> {
    return this.request<T>(`/users/${id}`)
  }

  async createUser<T = any, D = any>(data: D): Promise<T> {
    return this.request<T>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateUser<T = any, D = any>(id: string, data: D): Promise<T> {
    return this.request<T>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteUser(id: string): Promise<void> {
    return this.request<void>(`/users/${id}`, {
      method: 'DELETE',
    })
  }

  // Departments endpoints
  async getDepartments<T = any>(): Promise<T[]> {
    return this.request<T[]>('/departments')
  }

  async getDepartment<T = any>(id: string): Promise<T> {
    return this.request<T>(`/departments/${id}`)
  }

  async createDepartment<T = any, D = any>(data: D): Promise<T> {
    return this.request<T>('/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateDepartment<T = any, D = any>(id: string, data: D): Promise<T> {
    return this.request<T>(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteDepartment(id: string): Promise<void> {
    return this.request<void>(`/departments/${id}`, {
      method: 'DELETE',
    })
  }

  // Roles endpoints
  async getRoles<T = any>(): Promise<T[]> {
    return this.request<T[]>('/roles')
  }

  async getRole<T = any>(id: string): Promise<T> {
    return this.request<T>(`/roles/${id}`)
  }

  async createRole<T = any, D = any>(data: D): Promise<T> {
    return this.request<T>('/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateRole<T = any, D = any>(id: string, data: D): Promise<T> {
    return this.request<T>(`/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteRole(id: string): Promise<void> {
    return this.request<void>(`/roles/${id}`, {
      method: 'DELETE',
    })
  }
}

export const apiService = new ApiService()

