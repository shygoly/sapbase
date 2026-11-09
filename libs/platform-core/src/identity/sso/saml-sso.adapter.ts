import { requireConfig, SsoError, type SsoAdapter, type SsoCallbackInput, type SsoIdentity } from './sso-adapter'

export interface SamlConfig {
  entryPoint?: unknown
  issuer?: unknown
  callbackUrl?: unknown
  certificate?: unknown
  [key: string]: unknown
}

export type SamlSignatureVerifier = (xml: string, certificate: string) => Promise<boolean> | boolean

/**
 * SAML 2.0 SP adapter（最小实现）：
 *   - 生成 IdP 登录 URL（RelayState = state）
 *   - 解析 base64 SAMLResponse：NameID、Attribute、Conditions 时间窗
 *   - 签名验证通过注入 verifier（默认未配置即 fail-closed）
 *
 * 不自己实现 XML DSig；生产注入经过审计的 verifier（证书/指纹固定）。
 */
export class SamlSsoAdapter implements SsoAdapter {
  readonly type = 'saml' as const
  private readonly entryPoint: string
  private readonly issuer: string
  private readonly certificate: string | null
  private readonly verifier: SamlSignatureVerifier

  constructor(
    config: SamlConfig,
    options: { verifier?: SamlSignatureVerifier } = {},
  ) {
    const required = requireConfig(config, ['entryPoint', 'issuer'])
    this.entryPoint = required.entryPoint
    this.issuer = required.issuer
    this.certificate =
      typeof config.certificate === 'string' && config.certificate.length > 0
        ? config.certificate
        : null
    this.verifier = options.verifier ?? (() => false)
  }

  authorizationUrl(input: { state?: string } = {}): string {
    const url = new URL(this.entryPoint)
    if (input.state) url.searchParams.set('RelayState', input.state)
    return url.toString()
  }

  async authenticate(input: SsoCallbackInput): Promise<SsoIdentity> {
    if (!input.samlResponse) {
      throw new SsoError('缺少 SAMLResponse', 'authentication-failed')
    }
    if (!this.certificate) {
      throw new SsoError('SAML 未配置 IdP 证书，拒绝未验签断言', 'not-configured')
    }
    let xml: string
    try {
      xml = Buffer.from(input.samlResponse, 'base64').toString('utf8')
    } catch {
      throw new SsoError('SAMLResponse 不是合法 base64', 'invalid-response')
    }
    if (!/<(?:saml2?:)?Assertion[\s>]/i.test(xml)) {
      throw new SsoError('SAMLResponse 缺少 Assertion', 'invalid-response')
    }
    const verified = await this.verifier(xml, this.certificate)
    if (!verified) {
      throw new SsoError('SAML 断言签名校验失败', 'invalid-token')
    }
    assertConditions(xml)
    const externalId = firstTag(xml, ['NameID', 'NameId'])?.trim()
    if (!externalId) {
      throw new SsoError('SAML 断言缺少 NameID', 'invalid-response')
    }
    return { externalId, attributes: parseSamlAttributes(xml) }
  }
}

function assertConditions(xml: string): void {
  const notBefore = attr(xml, 'NotBefore')
  const notOnOrAfter = attr(xml, 'NotOnOrAfter')
  const now = Date.now()
  if (notBefore) {
    const ts = new Date(notBefore).getTime()
    if (Number.isFinite(ts) && now < ts) {
      throw new SsoError('SAML 断言尚未生效', 'invalid-token')
    }
  }
  if (notOnOrAfter) {
    const ts = new Date(notOnOrAfter).getTime()
    if (Number.isFinite(ts) && now >= ts) {
      throw new SsoError('SAML 断言已过期', 'invalid-token')
    }
  }
}

function attr(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`${name}="([^"]+)"`, 'i'))
  return match?.[1] ?? null
}

function firstTag(xml: string, names: string[]): string | null {
  for (const name of names) {
    const match = xml.match(new RegExp(`<(?:saml2?:)?${name}[^>]*>([\\s\\S]*?)</(?:saml2?:)?${name}>`, 'i'))
    if (match) return match[1]
  }
  return null
}

function parseSamlAttributes(xml: string): Record<string, unknown> {
  const attributes: Record<string, unknown> = {}
  const pattern = /<(?:saml2?:)?Attribute\b[^>]*\bName="([^"]+)"[^>]*>([\s\S]*?)<\/(?:saml2?:)?Attribute>/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(xml))) {
    const values: string[] = []
    const valuePattern = /<(?:saml2?:)?AttributeValue[^>]*>([\s\S]*?)<\/(?:saml2?:)?AttributeValue>/gi
    let value: RegExpExecArray | null
    while ((value = valuePattern.exec(match[2]))) {
      values.push(value[1].trim())
    }
    attributes[match[1]] = values.length > 1 ? values : values[0]
  }
  return attributes
}
