import { Injectable } from '@nestjs/common'
import type { IdentityProvider } from './identity-provider.entity'
import {
  IdentitySourceError,
  type ExternalIdentity,
  type IdentitySourceAdapter,
} from './identity-source'

/**
 * 确定性本地身份源：provider.config.users 提供静态用户列表。
 * 用于开发/测试和“先同步一次快照”的客户；生产可替换为 CAS/OIDC/SCIM adapter。
 */
@Injectable()
export class StaticIdentitySourceAdapter implements IdentitySourceAdapter {
  readonly type = 'static'

  async listUsers(provider?: IdentityProvider): Promise<ExternalIdentity[]> {
    const users = provider?.config?.users
    if (!Array.isArray(users)) {
      throw new IdentitySourceError(
        `provider ${provider?.key ?? '(unknown)'} 缺少 config.users`,
        'source-failed',
      )
    }
    return users.map((raw, index) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new IdentitySourceError(`config.users[${index}] 不是对象`, 'source-failed')
      }
      const item = raw as Record<string, unknown>
      const externalId = String(item.externalId ?? item.id ?? '').trim()
      const email = String(item.email ?? '').trim()
      if (!externalId || !email) {
        throw new IdentitySourceError(
          `config.users[${index}] 缺少 externalId/email`,
          'source-failed',
        )
      }
      return {
        externalId,
        email,
        name: typeof item.name === 'string' ? item.name : undefined,
        active: item.active !== false,
        attributes:
          item.attributes && typeof item.attributes === 'object'
            ? (item.attributes as Record<string, unknown>)
            : { email },
      }
    })
  }
}
