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
  async findAll(page: number = 1, pageSize: number = 10): Promise<PaginatedResponse<Department>> {
    const response = await httpClient.get<any>('/api/departments', {
      params: {
        page,
        pageSize,
      },
    })
    // Backend returns PaginatedResponseDto: { code, message, data: T[], pagination: { page, pageSize, total, totalPages } }
    const responseData = response.data
    if (responseData.pagination) {
      // Response has pagination structure
      return {
        data: responseData.data || [],
        total: responseData.pagination.total,
        page: responseData.pagination.page,
        limit: responseData.pagination.pageSize,
        totalPages: responseData.pagination.totalPages,
      }
    }
    // Fallback: if data is directly an array
    if (Array.isArray(responseData.data)) {
      return {
        data: responseData.data,
        total: responseData.data.length,
        page,
        limit: pageSize,
        totalPages: Math.ceil(responseData.data.length / pageSize),
      }
    }
    // Last fallback
    return {
      data: [],
      total: 0,
      page,
      limit: pageSize,
      totalPages: 0,
    }
  },

  /**
   * Get a specific department by ID
   */
  async findOne(id: string): Promise<Department> {
    const response = await httpClient.get<any>(`/api/departments/${id}`)
    // Unwrap the response (backend returns { code, message, data: Department })
    return response.data.data || response.data
  },

  /**
   * Create a new department
   */
  async create(createDeptDto: CreateDepartmentInput): Promise<Department> {
    const response = await httpClient.post<any>('/api/departments', createDeptDto)
    // Unwrap the response (backend returns { code, message, data: Department })
    return response.data.data || response.data
  },

  /**
   * Update a department
   */
  async update(id: string, updateDeptDto: UpdateDepartmentInput): Promise<Department> {
    const response = await httpClient.put<any>(`/api/departments/${id}`, updateDeptDto)
    // Unwrap the response (backend returns { code, message, data: Department })
    return response.data.data || response.data
  },

  /**
   * Delete a department
   */
  async delete(id: string): Promise<void> {
    await httpClient.delete(`/api/departments/${id}`)
  },
}
