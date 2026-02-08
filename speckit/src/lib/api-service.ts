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
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null as T
    }

    return response.json()
  }

  // Users endpoints
  async getUsers(): Promise<any[]> {
    return this.request('/users')
  }

  async getUser(id: string): Promise<any> {
    return this.request(`/users/${id}`)
  }

  async createUser(data: any): Promise<any> {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateUser(id: string, data: any): Promise<any> {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteUser(id: string): Promise<void> {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    })
  }

  // Departments endpoints
  async getDepartments(): Promise<any[]> {
    return this.request('/departments')
  }

  async getDepartment(id: string): Promise<any> {
    return this.request(`/departments/${id}`)
  }

  async createDepartment(data: any): Promise<any> {
    return this.request('/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateDepartment(id: string, data: any): Promise<any> {
    return this.request(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteDepartment(id: string): Promise<void> {
    return this.request(`/departments/${id}`, {
      method: 'DELETE',
    })
  }

  // Roles endpoints
  async getRoles(): Promise<any[]> {
    return this.request('/roles')
  }

  async getRole(id: string): Promise<any> {
    return this.request(`/roles/${id}`)
  }

  async createRole(data: any): Promise<any> {
    return this.request('/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateRole(id: string, data: any): Promise<any> {
    return this.request(`/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteRole(id: string): Promise<void> {
    return this.request(`/roles/${id}`, {
      method: 'DELETE',
    })
  }
}

export const apiService = new ApiService()

