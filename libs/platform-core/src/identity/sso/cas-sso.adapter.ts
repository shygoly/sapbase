import { requireConfig, SsoError, type SsoAdapter, type SsoCallbackInput, type SsoIdentity } from './sso-adapter'

export interface CasConfig {
  baseUrl?: unknown
  serviceUrl?: unknown
  [key: string]: unknown
}

/**
 * CAS 2.0/3.0 adapter：
 *   - 登录：`{baseUrl}/login?service=...`
 *   - 校验：`{baseUrl}/serviceValidate?ticket=...&service=...`
 *
 * 只做协议适配；身份映射/JIT 建号由 IdentitySsoService 负责。
 */
export class CasSsoAdapter implements SsoAdapter {
  readonly type = 'cas' as const
  private readonly baseUrl: string
  private readonly serviceUrl: string
  private readonly fetcher: typeof fetch

  constructor(
    config: CasConfig,
    options: { fetcher?: typeof fetch } = {},
  ) {
    const required = requireConfig(config, ['baseUrl', 'serviceUrl'])
    this.baseUrl = required.baseUrl.replace(/\/$/, '')
    this.serviceUrl = required.serviceUrl
    this.fetcher = options.fetcher ?? fetch
  }

  authorizationUrl(input: { state?: string } = {}): string {
    const service = input.state
      ? `${this.serviceUrl}${this.serviceUrl.includes('?') ? '&' : '?'}state=${encodeURIComponent(input.state)}`
      : this.serviceUrl
    return `${this.baseUrl}/login?service=${encodeURIComponent(service)}`
  }

  async authenticate(input: SsoCallbackInput): Promise<SsoIdentity> {
    if (!input.ticket) throw new SsoError('缺少 CAS ticket', 'authentication-failed')
    const url = `${this.baseUrl}/serviceValidate?ticket=${encodeURIComponent(input.ticket)}&service=${encodeURIComponent(this.serviceUrl)}`
    let response: Response
    try {
      response = await this.fetcher(url, { method: 'GET', redirect: 'manual' })
    } catch (error) {
      throw new SsoError(`CAS 校验请求失败：${(error as Error).message}`, 'authentication-failed')
    }
    const text = await response.text()
    if (!response.ok) {
      throw new SsoError(`CAS 校验 HTTP ${response.status}`, 'authentication-failed')
    }
    if (/authenticationFailure/i.test(text)) {
      const message = text.match(/<cas:authenticationFailure[^>]*>([\s\S]*?)<\/cas:authenticationFailure>/i)?.[1]
      throw new SsoError(`CAS 认证失败：${message ?? 'unknown'}`, 'authentication-failed')
    }
    const user = text.match(/<(?:cas:)?user>([\s\S]*?)<\/(?:cas:)?user>/i)?.[1]?.trim()
    if (!user) {
      throw new SsoError('CAS 响应缺少 user', 'invalid-response')
    }
    return { externalId: user, attributes: parseCasAttributes(text) }
  }
}

function parseCasAttributes(xml: string): Record<string, unknown> {
  const block = xml.match(/<(?:cas:)?attributes>([\s\S]*?)<\/(?:cas:)?attributes>/i)?.[1]
  if (!block) return {}
  const attributes: Record<string, unknown> = {}
  const pattern = /<(?:cas:)?([A-Za-z][A-Za-z0-9_.-]*)>([\s\S]*?)<\/(?:cas:)?\1>/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(block))) {
    attributes[match[1]] = match[2].trim()
  }
  return attributes
}
