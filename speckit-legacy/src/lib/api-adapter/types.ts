// API Adapter types

export interface ApiResponse<T> {
  data: T
  error?: string
  status: number
}

export interface ApiAdapterConfig {
  baseUrl: string
  timeout?: number
  headers?: Record<string, string>
}

export interface ApiAdapter {
  get<T>(path: string, options?: RequestOptions): Promise<T>
  post<T>(path: string, data: any, options?: RequestOptions): Promise<T>
  put<T>(path: string, data: any, options?: RequestOptions): Promise<T>
  delete<T>(path: string, options?: RequestOptions): Promise<T>
  patch<T>(path: string, data: any, options?: RequestOptions): Promise<T>
}

export interface RequestOptions {
  headers?: Record<string, string>
  params?: Record<string, any>
  timeout?: number
}

export interface MockStoreConfig {
  delay?: number
  data?: Record<string, any>
}
