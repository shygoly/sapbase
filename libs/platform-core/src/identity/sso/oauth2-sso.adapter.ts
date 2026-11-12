import {
  requireConfig,
  resolveSecret,
  SsoError,
  type SsoAdapter,
  type SsoCallbackInput,
  type SsoIdentity,
} from './sso-adapter'

export interface OAuth2Config {
  authorizationEndpoint?: unknown
  tokenEndpoint?: unknown
  userinfoEndpoint?: unknown
  clientId?: unknown
  clientSecretRef?: unknown
  redirectUri?: unknown
  scopes?: unknown
  [key: string]: unknown
}

/**
 * OAuth2-only adapter（无 id_token）：
 *   - 授权码换 access_token
 *   - 调用 userinfo 读取身份
 *
 * 不把 token endpoint 的响应当身份；userinfo 必须返回稳定 subject。
 */
export class Oauth2SsoAdapter implements SsoAdapter {
  readonly type = 'oauth2' as const
  private readonly authorizationEndpoint: string
  private readonly tokenEndpoint: string
  private readonly userinfoEndpoint: string
  private readonly clientId: string
  private readonly clientSecretRef: string | null
  private readonly redirectUri: string
  private readonly scopes: string
  private readonly fetcher: typeof fetch

  constructor(
    config: OAuth2Config,
    options: { fetcher?: typeof fetch } = {},
  ) {
    const required = requireConfig(config, [
      'authorizationEndpoint',
      'tokenEndpoint',
      'userinfoEndpoint',
      'clientId',
      'redirectUri',
    ])
    this.authorizationEndpoint = required.authorizationEndpoint
    this.tokenEndpoint = required.tokenEndpoint
    this.userinfoEndpoint = required.userinfoEndpoint
    this.clientId = required.clientId
    this.redirectUri = required.redirectUri
    this.clientSecretRef =
      typeof config.clientSecretRef === 'string' ? config.clientSecretRef : null
    this.scopes = typeof config.scopes === 'string' ? config.scopes : 'profile email'
    this.fetcher = options.fetcher ?? fetch
  }

  authorizationUrl(input: { state?: string } = {}): string {
    const url = new URL(this.authorizationEndpoint)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', this.clientId)
    url.searchParams.set('redirect_uri', this.redirectUri)
    url.searchParams.set('scope', this.scopes)
    if (input.state) url.searchParams.set('state', input.state)
    return url.toString()
  }

  async authenticate(input: SsoCallbackInput): Promise<SsoIdentity> {
    if (!input.code) throw new SsoError('缺少 OAuth2 code', 'authentication-failed')
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
    })
    if (this.clientSecretRef) {
      body.set('client_secret', resolveSecret(this.clientSecretRef))
    }
    let tokenResponse: Response
    try {
      tokenResponse = await this.fetcher(this.tokenEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        redirect: 'manual',
      })
    } catch (error) {
      throw new SsoError(`OAuth2 token 请求失败：${(error as Error).message}`, 'authentication-failed')
    }
    const tokenPayload = (await tokenResponse.json().catch(() => null)) as
      | { access_token?: string; error?: string }
      | null
    if (!tokenResponse.ok || !tokenPayload?.access_token) {
      throw new SsoError(
        `OAuth2 token 响应非法：${tokenPayload?.error ?? tokenResponse.status}`,
        'authentication-failed',
      )
    }
    let userinfoResponse: Response
    try {
      userinfoResponse = await this.fetcher(this.userinfoEndpoint, {
        method: 'GET',
        headers: { authorization: `Bearer ${tokenPayload.access_token}` },
        redirect: 'manual',
      })
    } catch (error) {
      throw new SsoError(`OAuth2 userinfo 请求失败：${(error as Error).message}`, 'authentication-failed')
    }
    const attributes = (await userinfoResponse.json().catch(() => null)) as
      | Record<string, unknown>
      | null
    if (!userinfoResponse.ok || !attributes || typeof attributes !== 'object') {
      throw new SsoError(`OAuth2 userinfo 响应非法：${userinfoResponse.status}`, 'invalid-response')
    }
    const externalId =
      firstString(attributes, ['sub', 'id', 'user_id', 'email']) ?? ''
    if (!externalId) {
      throw new SsoError('OAuth2 userinfo 缺少稳定 subject', 'invalid-response')
    }
    return { externalId, attributes }
  }
}

function firstString(
  attributes: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = attributes[key]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return null
}
