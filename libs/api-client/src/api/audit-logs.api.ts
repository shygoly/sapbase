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
        ...(filter?.status && { status: filter.status }),
        ...(filter?.actorType && { actorType: filter.actorType }),
        ...(filter?.source && { source: filter.source }),
        ...(filter?.correlationId && { correlationId: filter.correlationId }),
        ...(filter?.legalHold !== undefined && { legalHold: String(filter.legalHold) }),
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
  async verify(): Promise<{
    valid: boolean
    checked: number
    reason?: string
    brokenAt?: number
    checkpointSeq?: string | null
  }> {
    const response = await httpClient.get<any>('/api/audit-logs/verify')
    return response.data.data || response.data
  },

  async createCheckpoint(): Promise<{ seq?: string; signature?: string | null } | null> {
    const response = await httpClient.post<any>('/api/audit-logs/checkpoint', {})
    return response.data.data ?? response.data
  },

  async listCheckpoints(): Promise<Array<Record<string, unknown>>> {
    const response = await httpClient.get<any>('/api/audit-logs/checkpoints')
    return response.data.data || response.data || []
  },

  async catalog(): Promise<
    Array<{
      action: string
      resource: string
      requiredFields: string[]
      retentionClass: string
      highRisk?: boolean
    }>
  > {
    const response = await httpClient.get<any>('/api/audit-logs/catalog')
    return response.data.data || response.data || []
  },

  async listArchives(): Promise<Array<Record<string, unknown>>> {
    const response = await httpClient.get<any>('/api/audit-logs/archives')
    return response.data.data || response.data || []
  },

  async restore(archiveId: string): Promise<{ restored: number; archiveId: string }> {
    const response = await httpClient.post<any>('/api/audit-logs/restore', { archiveId })
    return response.data.data || response.data
  },

  async setLegalHold(
    id: string,
    legalHold: boolean,
    reason?: string,
  ): Promise<{ updated: boolean }> {
    const response = await httpClient.post<any>(`/api/audit-logs/${id}/legal-hold`, {
      legalHold,
      reason,
    })
    return response.data.data || response.data
  },

  async alerts(windowMinutes = 1440): Promise<{
    windowMinutes: number
    alerts: Array<Record<string, unknown>>
  }> {
    const response = await httpClient.get<any>('/api/audit-logs/alerts', {
      params: { windowMinutes },
    })
    return response.data.data || response.data
  },

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
