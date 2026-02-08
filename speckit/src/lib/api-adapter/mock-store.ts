import type { ApiAdapter, MockStoreConfig, RequestOptions } from './types'

export class MockStore implements ApiAdapter {
  private data: Record<string, any>
  private delay: number

  constructor(config: MockStoreConfig = {}) {
    this.data = config.data || {}
    this.delay = config.delay || 100
  }

  async get<T>(path: string, _options?: RequestOptions): Promise<T> {
    await this.simulateDelay()
    const key = this.extractKey(path)
    return this.data[key] as T
  }

  async post<T>(path: string, data: any, _options?: RequestOptions): Promise<T> {
    await this.simulateDelay()
    const key = this.extractKey(path)
    const id = Math.random().toString(36).substr(2, 9)
    const newItem = { ...data, id }

    if (!Array.isArray(this.data[key])) {
      this.data[key] = []
    }
    this.data[key].push(newItem)
    return newItem as T
  }

  async put<T>(path: string, data: any, _options?: RequestOptions): Promise<T> {
    await this.simulateDelay()
    const key = this.extractKey(path)
    if (Array.isArray(this.data[key])) {
      const index = this.data[key].findIndex((item: any) => item.id === data.id)
      if (index !== -1) {
        this.data[key][index] = data
      }
    }
    return data as T
  }

  async delete<T>(path: string, _options?: RequestOptions): Promise<T> {
    await this.simulateDelay()
    const key = this.extractKey(path)
    if (Array.isArray(this.data[key])) {
      this.data[key] = this.data[key].filter((item: any) => item.id !== this.extractId(path))
    }
    return {} as T
  }

  async patch<T>(path: string, data: any, options?: RequestOptions): Promise<T> {
    await this.simulateDelay()
    return this.put<T>(path, data, options)
  }

  private async simulateDelay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.delay))
  }

  private extractKey(path: string): string {
    return path.split('/').filter(Boolean)[0] || 'data'
  }

  private extractId(path: string): string {
    const parts = path.split('/')
    return parts[parts.length - 1] || ''
  }

  setData(key: string, data: any): void {
    this.data[key] = data
  }

  getData(key: string): any {
    return this.data[key]
  }

  clear(): void {
    this.data = {}
  }
}
