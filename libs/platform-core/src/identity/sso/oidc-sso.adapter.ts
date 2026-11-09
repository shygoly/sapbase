import { createHash, randomBytes } from 'node:crypto'
import {
  requireConfig,
  resolveSecret,
  SsoError,
  type SsoAdapter,
  type SsoCallbackInput,
  type SsoIdentity,
} from './sso-adapter'

export interface OidcConfig {
  issuer?: unknown
  authorizationEndpoint?: unknown
  tokenEndpoint?: unknown
  jwksUri?: unknown
  clientId?: unknown
  clientSecretRef?: unknown
  redirectUri?: unknown
  scopes?: unknown
  [key: string]: unknown
}

export interface OidcDiscovery {
  authorization_endpoint: string
  token_endpoint: string
  jwks_uri: string
  issuer: string
}

export interface OidcVerifyInput {
  idToken: string
  nonce?: string
  issuer: string
  audience: string
  jwksUri: string
}

export type OidcVerifier = (input: OidcVerifyInput) => Promise<Record<string, unknown>>

/**
 * OIDC adapter：授权码 + PKCE + state/nonce，id_token 走注入的 verifier（默认 jose/JWKS）。
 * 不信任 token endpoint 返回的 userinfo；身份以验签后的 id_token 为准。
 */
export class OidcSsoAdapter implements SsoAdapter {
  readonly type = 'oidc' as const
  private readonly issuer: string
  private readonly clientId: string
  private readonly clientSecretRef: string | null
  private readonly redirectUri: string
  private readonly scopes: string
  private readonly authorizationEndpoint?: string
  private readonly tokenEndpoint?: string
  private readonly jwksUri?: string
  private readonly fetcher: typeof fetch
  private readonly verifier: OidcVerifier
  private discovery: OidcDiscovery | null = null

  constructor(
    config: OidcConfig,
    options: { fetcher?: typeof fetch; verifier?: OidcVerifier } = {},
  ) {
    const required = requireConfig(config, ['issuer', 'clientId', 'redirectUri'])
    this.issuer = required.issuer.replace(/\/$/, '')
    this.clientId = required.clientId
    this.redirectUri = required.redirectUri
    this.clientSecretRef =
      typeof config.clientSecretRef === 'string' ? config.clientSecretRef : null
    this.scopes =
      typeof config.scopes === 'string' ? config.scopes : 'openid profile email'
    this.authorizationEndpoint =
      typeof config.authorizationEndpoint === 'string' ? config.authorizationEndpoint : undefined
    this.tokenEndpoint =
      typeof config.tokenEndpoint === 'string' ? config.tokenEndpoint : undefined
    this.jwksUri = typeof config.jwksUri === 'string' ? config.jwksUri : undefined
    this.fetcher = options.fetcher ?? fetch
    this.verifier = options.verifier ?? defaultJoseVerifier
  }

  async authorizationUrl(input: {
    state?: string
    nonce?: string
    codeChallenge?: string
  } = {}): Promise<string> {
    const discovery = await this.getDiscovery()
    const url = new URL(discovery.authorization_endpoint)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', this.clientId)
    url.searchParams.set('redirect_uri', this.redirectUri)
    url.searchParams.set('scope', this.scopes)
    if (input.state) url.searchParams.set('state', input.state)
    if (input.nonce) url.searchParams.set('nonce', input.nonce)
    if (input.codeChallenge) {
      url.searchParams.set('code_challenge', input.codeChallenge)
      url.searchParams.set('code_challenge_method', 'S256')
    }
    return url.toString()
  }

  async authenticate(input: SsoCallbackInput): Promise<SsoIdentity> {
    if (!input.code) throw new SsoError('缺少 OIDC code', 'authentication-failed')
    const discovery = await this.getDiscovery()
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
    })
    if (input.codeVerifier) body.set('code_verifier', input.codeVerifier)
    if (this.clientSecretRef) {
      body.set('client_secret', resolveSecret(this.clientSecretRef))
    }
    let response: Response
    try {
      response = await this.fetcher(discovery.token_endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        redirect: 'manual',
      })
    } catch (error) {
      throw new SsoError(`OIDC token 请求失败：${(error as Error).message}`, 'authentication-failed')
    }
    const payload = (await response.json().catch(() => null)) as
      | { id_token?: string; access_token?: string; error?: string }
      | null
    if (!response.ok || !payload?.id_token) {
      throw new SsoError(
        `OIDC token 响应非法：${payload?.error ?? response.status}`,
        'authentication-failed',
      )
    }
    const claims = await this.verifier({
      idToken: payload.id_token,
      nonce: input.nonce,
      issuer: discovery.issuer,
      audience: this.clientId,
      jwksUri: discovery.jwks_uri,
    })
    if (claims.iss !== discovery.issuer || claims.aud !== this.clientId) {
      throw new SsoError('id_token issuer/audience 不匹配', 'invalid-token')
    }
    if (input.nonce && claims.nonce !== input.nonce) {
      throw new SsoError('id_token nonce 不匹配', 'invalid-state')
    }
    const externalId =
      (typeof claims.sub === 'string' && claims.sub) ||
      (typeof claims.email === 'string' && claims.email) ||
      ''
    if (!externalId) throw new SsoError('id_token 缺少 sub/email', 'invalid-token')
    return { externalId, attributes: claims }
  }

  private async getDiscovery(): Promise<OidcDiscovery> {
    if (
      this.authorizationEndpoint &&
      this.tokenEndpoint &&
      this.jwksUri
    ) {
      return {
        issuer: this.issuer,
        authorization_endpoint: this.authorizationEndpoint,
        token_endpoint: this.tokenEndpoint,
        jwks_uri: this.jwksUri,
      }
    }
    if (this.discovery) return this.discovery
    let response: Response
    try {
      response = await this.fetcher(`${this.issuer}/.well-known/openid-configuration`, {
        method: 'GET',
        redirect: 'manual',
      })
    } catch (error) {
      throw new SsoError(`OIDC discovery 失败：${(error as Error).message}`, 'not-configured')
    }
    const discovery = (await response.json().catch(() => null)) as OidcDiscovery | null
    if (
      !response.ok ||
      !discovery?.authorization_endpoint ||
      !discovery?.token_endpoint ||
      !discovery?.jwks_uri
    ) {
      throw new SsoError('OIDC discovery 响应非法', 'not-configured')
    }
    this.discovery = discovery
    return discovery
  }
}

/** PKCE：S256。 */
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

async function defaultJoseVerifier(input: OidcVerifyInput): Promise<Record<string, unknown>> {
  let jose: {
    createRemoteJWKSet: (url: URL) => unknown
    jwtVerify: (
      token: string,
      key: unknown,
      options: Record<string, unknown>,
    ) => Promise<{ payload: Record<string, unknown> }>
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    jose = require('jose')
  } catch {
    throw new SsoError('缺少 jose 依赖，无法验签 id_token', 'not-configured')
  }
  const jwks = jose.createRemoteJWKSet(new URL(input.jwksUri))
  const { payload } = await jose.jwtVerify(input.idToken, jwks, {
    issuer: input.issuer,
    audience: input.audience,
  })
  return payload
}
