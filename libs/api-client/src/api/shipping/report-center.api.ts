import { httpClient } from '../client'
import { reportCenter } from './mock-data'
import type { ReportCenterRecord } from './types'

interface ReportCenterFilterInput {
  reportType?: string
  vesselId?: string
  year?: number | string
}

function normalizeRecord(item: any): ReportCenterRecord {
  return {
    id: item.id,
    reportType: item.reportType,
    vesselName: item.vesselName || '--',
    year: item.year,
    exportedAt: item.exportedAt || item.createdAt || '',
    exportedBy: item.exportedBy || '--',
    parameters:
      typeof item.parameters === 'string'
        ? item.parameters
        : JSON.stringify(item.parameters || {}),
    fileName: item.fileName,
    downloadUrl: item.downloadUrl,
  }
}

export const reportCenterApi = {
  async findAll(filters: ReportCenterFilterInput = {}): Promise<ReportCenterRecord[]> {
    try {
      const response = await httpClient.get<any>('/api/shipping/report-center', {
        params: {
          reportType: filters.reportType || undefined,
          vesselId: filters.vesselId || undefined,
          year: filters.year ? Number(filters.year) : undefined,
        },
      })
      const data = response.data?.data || response.data || []
      return Array.isArray(data) ? data.map(normalizeRecord) : []
    } catch {
      return reportCenter.map(normalizeRecord)
    }
  },
}
