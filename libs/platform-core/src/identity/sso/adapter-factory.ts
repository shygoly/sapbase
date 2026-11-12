import type { IdentityProvider } from '../identity-provider.entity'
import { CasSsoAdapter } from './cas-sso.adapter'
import { OidcSsoAdapter } from './oidc-sso.adapter'
import { Oauth2SsoAdapter } from './oauth2-sso.adapter'
import { SamlSsoAdapter } from './saml-sso.adapter'
import { SsoError, type SsoAdapter } from './sso-adapter'

/** DI token：允许测试或宿主替换 SSO adapter 工厂。 */
export const SSO_ADAPTER_FACTORY = Symbol('SSO_ADAPTER_FACTORY')

export function createSsoAdapter(provider: IdentityProvider): SsoAdapter {
  const config = (provider.config ?? {}) as Record<string, unknown>
  switch (provider.type) {
    case 'cas':
      return new CasSsoAdapter(config)
    case 'oidc':
      return new OidcSsoAdapter(config)
    case 'saml':
      return new SamlSsoAdapter(config)
    case 'oauth2':
      return new Oauth2SsoAdapter(config)
    default:
      throw new SsoError(`未知 identity provider 类型：${provider.type}`, 'not-configured')
  }
}
