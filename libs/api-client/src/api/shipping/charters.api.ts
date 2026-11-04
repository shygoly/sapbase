import { httpClient } from '../client'
import { fetchShippingResource } from './http'
import { charters } from './mock-data'
import type { CharterRecord } from './types'

export interface CharterMutationInput {
  shipId: string
  charterer: string
  startDate: string
  endDate: string
  status?: string
  allocation?: string
}

export const chartersApi = {
  async findAll(): Promise<CharterRecord[]> {
    const response = await fetchShippingResource<any[]>('/api/shipping/charters', charters)
    return response.map((item) => ({
      ...item,
      vesselName: item.vesselName || item.ship?.name || '--',
      allocation: item.allocation || '--',
    })) as CharterRecord[]
  },
  async create(input: CharterMutationInput): Promise<CharterRecord> {
    const response = await httpClient.post<any>('/api/shipping/charters', input)
    return response.data?.data || response.data
  },
  async update(id: string, input: Partial<CharterMutationInput>): Promise<CharterRecord> {
    const response = await httpClient.patch<any>(`/api/shipping/charters/${id}`, input)
    return response.data?.data || response.data
  },
  async delete(id: string): Promise<void> {
    await httpClient.delete(`/api/shipping/charters/${id}`)
  },
}
