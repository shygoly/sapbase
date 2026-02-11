import type { ApiAdapter, ApiAdapterConfig, RequestOptions } from './types'

export class HttpApiAdapter implements ApiAdapter {
  private baseUrl: string
  private timeout: number
  private headers: Record<string, string>

  constructor(config: ApiAdapterConfig) {
    this.baseUrl = config.baseUrl
    this.timeout = config.timeout || 30000
    this.headers = config.headers || {}
  }

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options)
  }

  async post<T>(path: string, data: any, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, data, options)
  }

  async put<T>(path: string, data: any, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, data, options)
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options)
  }

  async patch<T>(path: string, data: any, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, data, options)
  }

  private async request<T>(
    method: string,
    path: string,
    data?: any,
    options?: RequestOptions
  ): Promise<T> {
    const url = new URL(path, this.baseUrl).toString()
    const headers = { ...this.headers, ...options?.headers }

    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      signal: AbortSignal.timeout(options?.timeout || this.timeout)
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }
}
