import { httpClient } from '../client'
import { fetchShippingResource } from './http'
import { voyages } from './mock-data'
import type { VoyageImportResult, VoyageRecord } from './types'

export const voyagesApi = {
  async findAll(): Promise<VoyageRecord[]> {
    const response = await fetchShippingResource<any[]>('/api/shipping/voyages', voyages)
    return response.map((item) => ({
      ...item,
      vesselName: item.vesselName || item.ship?.name || item.vesselName,
      throughIce: typeof item.throughIce === 'boolean' ? (item.throughIce ? 'Yes' : 'No') : item.throughIce,
    })) as VoyageRecord[]
  },

  async importFile(file: File): Promise<VoyageImportResult> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await httpClient.post<any>('/api/shipping/voyages/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data?.data || response.data
  },
}
