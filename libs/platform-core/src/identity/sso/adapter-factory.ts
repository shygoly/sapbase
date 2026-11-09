import type { IdentityProvider } from '../identity-provider.entity'
import { CasSsoAdapter } from './cas-sso.adapter'
import { OidcSsoAdapter } from './oidc-sso.adapter'
import { SsoError, type SsoAdapter } from './sso-adapter'

export function createSsoAdapter(provider: IdentityProvider): SsoAdapter {
  const config = (provider.config ?? {}) as Record<string, unknown>
  switch (provider.type) {
    case 'cas':
      return new CasSsoAdapter(config)
    case 'oidc':
      return new OidcSsoAdapter(config)
    case 'oauth2':
    case 'saml':
      throw new SsoError(
        `identity provider ${provider.key} 的 ${provider.type} adapter 尚未实现`,
        'not-configured',
      )
    default:
      throw new SsoError(`未知 identity provider 类型：${provider.type}`, 'not-configured')
  }
}
