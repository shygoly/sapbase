import { Injectable } from '@nestjs/common'

export interface ExternalIdentity {
  externalId: string
  email: string
  name?: string
  active: boolean
  attributes?: Record<string, unknown>
}

export interface IdentitySourceAdapter {
  /** 与 identity_providers.type 对应；同一类型可替换实现。 */
  readonly type: string
  listUsers(): Promise<ExternalIdentity[]>
}

export class IdentitySourceError extends Error {
  constructor(message: string, readonly reason: 'unknown-adapter' | 'source-failed') {
    super(message)
    this.name = 'IdentitySourceError'
  }
}

@Injectable()
export class IdentitySourceAdapterRegistry {
  private readonly adapters = new Map<string, IdentitySourceAdapter>()

  register(adapter: IdentitySourceAdapter): void {
    if (!adapter.type) throw new IdentitySourceError('adapter 缺少 type', 'unknown-adapter')
    this.adapters.set(adapter.type, adapter)
  }

  get(type: string): IdentitySourceAdapter {
    const adapter = this.adapters.get(type)
    if (!adapter) {
      throw new IdentitySourceError(`未注册身份源 adapter：${type}`, 'unknown-adapter')
    }
    return adapter
  }

  has(type: string): boolean {
    return this.adapters.has(type)
  }
}
