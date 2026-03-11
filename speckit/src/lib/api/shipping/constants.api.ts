import { httpClient } from '@/lib/api/client'
import { fetchShippingResource } from './http'
import { reportTypeOptions, shipOptions, years } from './mock-data'
import type {
  ShippingOption,
  YearParameterRecord,
  FuelTypeRecord,
  CiiShipTypeParameterRecord,
} from './types'

export const constantsApi = {
  async getShips(): Promise<ShippingOption[]> {
    return fetchShippingResource('/api/shipping/constants/ships', shipOptions)
  },

  async getYears(): Promise<ShippingOption[]> {
    try {
      const response = await httpClient.get<YearParameterRecord[]>('/api/shipping/constants/years')
      const data = response.data?.data ?? response.data
      const list = Array.isArray(data) ? data : []
      return list.map((y) => ({ label: String(y.year), value: String(y.year) }))
    } catch {
      return years
    }
  },

  async getReportTypes(): Promise<ShippingOption[]> {
    return fetchShippingResource('/api/shipping/constants/report-types', reportTypeOptions)
  },

  // Years CRUD
  async listYears(): Promise<YearParameterRecord[]> {
    const response = await httpClient.get<YearParameterRecord[]>('/api/shipping/constants/years')
    const data = response.data?.data ?? response.data
    return Array.isArray(data) ? data : []
  },

  async createYear(payload: Omit<YearParameterRecord, 'id'>): Promise<YearParameterRecord> {
    const response = await httpClient.post<YearParameterRecord>(
      '/api/shipping/constants/years',
      payload,
    )
    return response.data?.data ?? response.data
  },

  async updateYear(id: string, payload: Partial<YearParameterRecord>): Promise<YearParameterRecord> {
    const response = await httpClient.patch<YearParameterRecord>(
      `/api/shipping/constants/years/${id}`,
      payload,
    )
    return response.data?.data ?? response.data
  },

  async deleteYear(id: string): Promise<void> {
    await httpClient.delete(`/api/shipping/constants/years/${id}`)
  },

  // Fuel types CRUD (system + tenant)
  async listFuelTypes(): Promise<FuelTypeRecord[]> {
    const response = await httpClient.get<FuelTypeRecord[]>(
      '/api/shipping/constants/fuels/system',
    )
    const data = response.data?.data ?? response.data
    return Array.isArray(data) ? data : []
  },

  async createFuelType(payload: Partial<FuelTypeRecord> & { name: string; scope?: 'system' | 'tenant' }): Promise<FuelTypeRecord> {
    const response = await httpClient.post<FuelTypeRecord>(
      '/api/shipping/constants/fuels/system',
      { ...payload, defaultPrice: payload.defaultPrice ?? payload.price ?? 0 },
    )
    return response.data?.data ?? response.data
  },

  async updateFuelType(
    id: string,
    payload: Partial<FuelTypeRecord>,
  ): Promise<FuelTypeRecord> {
    const response = await httpClient.patch<FuelTypeRecord>(
      `/api/shipping/constants/fuels/system/${id}`,
      { ...payload, defaultPrice: payload.defaultPrice ?? payload.price },
    )
    return response.data?.data ?? response.data
  },

  async deleteFuelType(id: string): Promise<void> {
    await httpClient.delete(`/api/shipping/constants/fuels/system/${id}`)
  },

  // CII ship types CRUD
  async listCiiShipTypes(): Promise<CiiShipTypeParameterRecord[]> {
    const response = await httpClient.get<CiiShipTypeParameterRecord[]>(
      '/api/shipping/constants/cii-ship-types',
    )
    const data = response.data?.data ?? response.data
    return Array.isArray(data) ? data : []
  },

  async createCiiShipType(
    payload: Omit<CiiShipTypeParameterRecord, 'id'>,
  ): Promise<CiiShipTypeParameterRecord> {
    const response = await httpClient.post<CiiShipTypeParameterRecord>(
      '/api/shipping/constants/cii-ship-types',
      payload,
    )
    return response.data?.data ?? response.data
  },

  async updateCiiShipType(
    id: string,
    payload: Partial<CiiShipTypeParameterRecord>,
  ): Promise<CiiShipTypeParameterRecord> {
    const response = await httpClient.patch<CiiShipTypeParameterRecord>(
      `/api/shipping/constants/cii-ship-types/${id}`,
      payload,
    )
    return response.data?.data ?? response.data
  },

  async deleteCiiShipType(id: string): Promise<void> {
    await httpClient.delete(`/api/shipping/constants/cii-ship-types/${id}`)
  },
}
