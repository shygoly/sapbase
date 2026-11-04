import { httpClient } from '../client'
import { reportData } from './mock-data'

export const reportsApi = {
  async getReport(type: keyof typeof reportData, vesselId?: string, year?: number | string) {
    try {
      const response = await httpClient.get<any>(`/api/shipping/reports/${type}`, {
        params: {
          shipId: vesselId || undefined,
          year: year ? Number(year) : undefined,
        },
      })
      return response.data?.data || response.data
    } catch {
      return reportData[type]
    }
  },

  async exportReport(reportType: string, vesselId?: string, year?: number | string) {
    const response = await httpClient.post<any>('/api/shipping/reports/export', {
      reportType: reportType.replace(/-/g, '_'),
      vesselId,
      year: year ? Number(year) : undefined,
    })
    return response.data?.data || response.data
  },
}
