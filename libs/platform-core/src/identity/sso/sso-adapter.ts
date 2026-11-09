export interface SsoIdentity {
  externalId: string
  attributes: Record<string, unknown>
}

export interface SsoAuthorizationInput {
  state?: string
  nonce?: string
  codeChallenge?: string
}

export interface SsoCallbackInput {
  ticket?: string
  code?: string
  codeVerifier?: string
  state?: string
  nonce?: string
}

export interface SsoAdapter {
  readonly type: 'cas' | 'oauth2' | 'oidc' | 'saml'
  authorizationUrl(input?: SsoAuthorizationInput): Promise<string> | string
  authenticate(input: SsoCallbackInput): Promise<SsoIdentity>
}

export class SsoError extends Error {
  constructor(
    message: string,
    readonly reason:
      | 'not-configured'
      | 'invalid-response'
      | 'authentication-failed'
      | 'invalid-state'
      | 'invalid-token',
  ) {
    super(message)
    this.name = 'SsoError'
  }
}

export function requireConfig(
  config: Record<string, unknown>,
  keys: string[],
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const key of keys) {
    const value = config[key]
    if (typeof value !== 'string' || value.length === 0) {
      throw new SsoError(`SSO 配置缺少 ${key}`, 'not-configured')
    }
    result[key] = value
  }
  return result
}

export function resolveSecret(secretRef: string | null | undefined): string {
  if (!secretRef) throw new SsoError('SSO 缺少 secretRef', 'not-configured')
  const value = process.env[secretRef]
  if (!value) throw new SsoError(`SSO secret 未配置：${secretRef}`, 'not-configured')
  return value
}
