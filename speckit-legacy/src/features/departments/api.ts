// Department management API client

import { apiService } from '@/lib/api-service'

export interface Department {
  id: string
  name: string
  description?: string
  managerId?: string
  status: 'active' | 'inactive'
  createdAt: Date
  updatedAt: Date
}

export interface CreateDepartmentInput {
  name: string
  description?: string
  managerId?: string
}

export interface UpdateDepartmentInput {
  name?: string
  description?: string
  managerId?: string
}

export const departmentApi = {
  async getDepartments(): Promise<Department[]> {
    return apiService.getDepartments()
  },

  async getDepartment(id: string): Promise<Department> {
    return apiService.getDepartment(id)
  },

  async createDepartment(input: CreateDepartmentInput): Promise<Department> {
    return apiService.createDepartment(input)
  },

  async updateDepartment(id: string, input: UpdateDepartmentInput): Promise<Department> {
    return apiService.updateDepartment(id, input)
  },

  async deleteDepartment(id: string): Promise<void> {
    return apiService.deleteDepartment(id)
  },
}
