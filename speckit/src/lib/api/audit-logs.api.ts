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
  ) {
    const response = await httpClient.get<PaginatedResponse<AuditLog>>('/api/audit-logs', {
      params: {
        page,
        pageSize,
        ...filter,
      },
    })
    return response.data
  },

  /**
   * Get a specific audit log by ID
   */
  async findOne(id: string): Promise<AuditLog> {
    const response = await httpClient.get<AuditLog>(`/audit-logs/${id}`)
    return response.data
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
