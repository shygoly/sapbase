/**
 * Audit Logs API Service
 * Handles audit log endpoints
 */

import { httpClient } from './client'
import { AuditLog, AuditLogFilter, PaginatedResponse } from './types'

export const auditLogsApi = {
  /**
   * Get all audit logs with filtering and pagination
   */
  async findAll(
    page: number = 1,
    pageSize: number = 10,
    filter?: Partial<AuditLogFilter>,
  ): Promise<PaginatedResponse<AuditLog>> {
    const response = await httpClient.get<any>('/api/audit-logs', {
      params: {
        page,
        pageSize,
        // Map filter properties to backend expected names
        ...(filter?.action && { action: filter.action }),
        ...(filter?.resourceType && { resource: filter.resourceType }),
        ...(filter?.actor && { actor: filter.actor }),
        ...(filter?.resourceId && { resourceId: filter.resourceId }),
        ...(filter?.startDate && { startDate: filter.startDate }),
        ...(filter?.endDate && { endDate: filter.endDate }),
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
    
    // Fallback: check if data is directly in responseData
    if (Array.isArray(responseData.data)) {
      return {
        data: responseData.data,
        total: responseData.pagination?.total || responseData.data.length,
        page,
        limit: pageSize,
        totalPages: Math.ceil((responseData.pagination?.total || responseData.data.length) / pageSize),
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
   * Get a specific audit log by ID
   */
  async findOne(id: string): Promise<AuditLog> {
    const response = await httpClient.get<any>(`/api/audit-logs/${id}`)
    return response.data.data || response.data
  },

  /**
   * Export audit logs as CSV or JSON
   */
  async export(filter?: Partial<AuditLogFilter>, format: 'csv' | 'json' = 'csv') {
    const response = await httpClient.post('/api/audit-logs/export', filter || {}, {
      params: { format },
      responseType: 'blob',
    })
    return response.data
  },

  /**
   * Download exported file
   */
  downloadFile(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  },
}
