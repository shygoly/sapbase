import { httpClient } from '../client'
import { fetchShippingResource } from './http'
import { ships, shipOptions } from './mock-data'
import type { ShipRecord, ShippingOption } from './types'

export interface ShipMutationInput {
  name: string
  imo: string
  type: string
  status?: string
  ciiRating?: string
  dwt?: number
  speed?: number
}

export const shipsApi = {
  async findAll(): Promise<ShipRecord[]> {
    const response = await fetchShippingResource<any[]>('/api/shipping/ships', ships)
    return response.map((item) => ({
      ...item,
      rating: item.rating || item.ciiRating,
      ciiRating: item.ciiRating || item.rating,
      dwt: Number(item.dwt ?? 0),
      speed: Number(item.speed ?? 0),
    })) as ShipRecord[]
  },
  async getOptions(): Promise<ShippingOption[]> {
    return fetchShippingResource('/api/shipping/constants/ships', shipOptions)
  },
  async create(input: ShipMutationInput): Promise<ShipRecord> {
    const response = await httpClient.post<any>('/api/shipping/ships', input)
    return response.data?.data || response.data
  },
  async update(id: string, input: Partial<ShipMutationInput>): Promise<ShipRecord> {
    const response = await httpClient.put<any>(`/api/shipping/ships/${id}`, input)
    return response.data?.data || response.data
  },
  async delete(id: string): Promise<void> {
    await httpClient.delete(`/api/shipping/ships/${id}`)
  },
}
