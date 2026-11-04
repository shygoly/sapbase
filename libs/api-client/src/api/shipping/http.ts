import { httpClient } from '../client'

export async function fetchShippingResource<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await httpClient.get<any>(path)
    return (response.data?.data ?? response.data ?? fallback) as T
  } catch {
    return fallback
  }
}
