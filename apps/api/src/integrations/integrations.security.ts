import { createHmac, timingSafeEqual } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const PRIVATE_HOST_RE =
  /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.169\.254|::1|fc00:|fd00:|fe80:)/i

export class IntegrationSecurityError extends Error {
  constructor(
    message: string,
    readonly reason:
      | 'ssrf'
      | 'secret'
      | 'signature'
      | 'timestamp'
      | 'payload'
      | 'scope',
  ) {
    super(message)
    this.name = 'IntegrationSecurityError'
  }
}

export function resolveSecret(ref: string | null | undefined): string {
  if (!ref) throw new IntegrationSecurityError('缺少 secretRef', 'secret')
  const name = ref.startsWith('env:') ? ref.slice(4) : ref
  const value = process.env[name]
  if (!value) {
    throw new IntegrationSecurityError(`secretRef 未解析到值：${ref}`, 'secret')
  }
  return value
}

function hostAllowed(host: string, allowlist: string[]): boolean {
  return allowlist.some((entry) => {
    const normalized = entry.trim().toLowerCase()
    if (!normalized) return false
    if (normalized === '*') return true
    if (normalized.startsWith('*.')) return host.endsWith(normalized.slice(1))
    return host === normalized
  })
}

export function assertSafeOutboundUrl(
  raw: string,
  allowlist: string[] = [],
): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new IntegrationSecurityError(`URL 非法：${raw}`, 'ssrf')
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new IntegrationSecurityError(`只允许 http/https：${url.protocol}`, 'ssrf')
  }
  if (url.username || url.password) {
    throw new IntegrationSecurityError('URL 不得包含用户名/密码', 'ssrf')
  }
  const host = url.hostname.toLowerCase()
  const allowPrivate = process.env.INTEGRATION_ALLOW_PRIVATE === 'true'
  const ipVersion = isIP(host)
  if (!allowPrivate && (PRIVATE_HOST_RE.test(host) || ipVersion > 0)) {
    if (!hostAllowed(host, allowlist)) {
      throw new IntegrationSecurityError(`目标地址未授权/私网：${host}`, 'ssrf')
    }
  }
  if (host === '169.254.169.254' || host.endsWith('.metadata.google.internal')) {
    throw new IntegrationSecurityError('禁止访问云元数据地址', 'ssrf')
  }
  return url
}

function isPrivateAddress(address: string): boolean {
  return (
    PRIVATE_HOST_RE.test(address) ||
    address.startsWith('::ffff:127.') ||
    address.startsWith('::ffff:10.') ||
    address.startsWith('::ffff:192.168.')
  )
}

/** 防 DNS rebinding：允许名单外的主机必须解析到公网地址。 */
export async function assertResolvedHostSafe(
  url: URL,
  allowlist: string[] = [],
): Promise<void> {
  const host = url.hostname.toLowerCase()
  if (hostAllowed(host, allowlist)) return
  if (isIP(host) > 0) {
    if (isPrivateAddress(host)) {
      throw new IntegrationSecurityError(`目标地址未授权/私网：${host}`, 'ssrf')
    }
    return
  }
  const addresses = await lookup(host, { all: true }).catch(() => [])
  if (addresses.length === 0) {
    throw new IntegrationSecurityError(`域名无法解析：${host}`, 'ssrf')
  }
  for (const item of addresses) {
    if (isPrivateAddress(item.address)) {
      throw new IntegrationSecurityError(`域名解析到私网地址：${host}`, 'ssrf')
    }
  }
}

export function assertSafeDbHost(host: string, allowlist: string[] = []): void {
  const normalized = host.toLowerCase()
  const allowPrivate = process.env.INTEGRATION_ALLOW_PRIVATE_DB === 'true'
  if (
    !allowPrivate &&
    (PRIVATE_HOST_RE.test(normalized) || isIP(normalized) > 0) &&
    !hostAllowed(normalized, allowlist)
  ) {
    throw new IntegrationSecurityError(`数据库主机未授权/私网：${host}`, 'ssrf')
  }
}

export function webhookSignature(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

export function verifyWebhookSignature(
  secret: string,
  timestamp: string,
  body: string,
  signature: string,
): void {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    throw new IntegrationSecurityError('Webhook 时间戳过期或非法', 'timestamp')
  }
  const expected = webhookSignature(secret, timestamp, body)
  const given = signature.replace(/^sha256=/, '')
  const left = Buffer.from(expected, 'utf8')
  const right = Buffer.from(given, 'utf8')
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new IntegrationSecurityError('Webhook 签名不匹配', 'signature')
  }
}

const SECRET_KEYS = /authorization|api[-_]?key|secret|token|password|cookie/i

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[TRUNCATED]'
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1))
  if (!value || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEYS.test(key) ? '[REDACTED]' : redact(item, depth + 1)
  }
  return out
}

export function truncateBody(value: string, max = 2000): string {
  return value.length > max ? `${value.slice(0, max)}…[truncated]` : value
}
