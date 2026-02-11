/**
 * Departments API Service
 * Handles department management endpoints
 */

import { httpClient } from './client'
import { Department, CreateDepartmentInput, UpdateDepartmentInput, PaginatedResponse } from './types'

export const departmentsApi = {
  /**
   * Get all departments with pagination
   */
  async findAll(page: number = 1, pageSize: number = 10) {
    const response = await httpClient.get<PaginatedResponse<Department>>('/departments', {
      params: {
        page,
        pageSize,
      },
    })
    return response.data
  },

  /**
   * Get a specific department by ID
   */
  async findOne(id: string): Promise<Department> {
    const response = await httpClient.get<Department>(`/departments/${id}`)
    return response.data
  },

  /**
   * Create a new department
   */
  async create(createDeptDto: CreateDepartmentInput): Promise<Department> {
    const response = await httpClient.$1<$2>('/api$3epartments', createDeptDto)
    return response.data
  },

  /**
   * Update a department
   */
  async update(id: string, updateDeptDto: UpdateDepartmentInput): Promise<Department> {
    const response = await httpClient.put<Department>(`/departments/${id}`, updateDeptDto)
    return response.data
  },

  /**
   * Delete a department
   */
  async delete(id: string): Promise<void> {
    await httpClient.delete(`/departments/${id}`)
  },
}
