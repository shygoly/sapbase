import { Injectable } from '@nestjs/common'

@Injectable()
export class ReleaseIdempotencyService {
  private readonly store = new Map<string, unknown>()

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.store.has(key)) return this.store.get(key) as T
    const result = await fn()
    this.store.set(key, result)
    return result
  }
}
