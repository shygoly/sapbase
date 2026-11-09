import { createHmac, timingSafeEqual } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { Injectable } from '@nestjs/common'
import { JobQueue } from './job-queue'
import type { JobRecord } from './job-types'

export interface SafeUrlOptions {
  allowHttp?: boolean
  allowPrivate?: boolean
  allowlist?: string[]
}

export class CallbackSecurityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CallbackSecurityError'
  }
}

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
]

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
  'instance-data',
])

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return PRIVATE_V4.some((pattern) => pattern.test(address))
  if (version === 6) {
    const normalized = address.toLowerCase()
    if (normalized === '::1' || normalized === '::') return true
    if (normalized.startsWith('fe80:')) return true
    if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return true
    // IPv4-mapped IPv6
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateAddress(mapped[1])
    return false
  }
  return false
}

function hostAllowed(host: string, allowlist: string[]): boolean {
  return allowlist.some((entry) => {
    const normalized = entry.toLowerCase()
    if (normalized.startsWith('*.')) {
      return host === normalized.slice(2) || host.endsWith(normalized.slice(1))
    }
    return host === normalized
  })
}

/**
 * 回调 URL 的同步安全判定：
 *   - 默认只允许 https；http 仅在显式 allowHttp 时允许（本地开发）
 *   - 拒绝凭证、localhost、私网/链路本地/元数据地址
 *   - allowlist 非空时 host 必须命中
 *
 * DNS 解析后的私网判定在 `assertSafeCallbackUrlResolved` 做（防 DNS rebinding
 * 的第一层；投递时仍禁止重定向并只连解析后的地址由 fetch 控制）。
 */
export function assertSafeCallbackUrl(
  raw: string,
  options: SafeUrlOptions = {},
): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new CallbackSecurityError(`回调 URL 非法：${raw}`)
  }
  if (url.protocol !== 'https:' && !(options.allowHttp && url.protocol === 'http:')) {
    throw new CallbackSecurityError(`回调 URL 必须是 https（当前 ${url.protocol}）`)
  }
  if (url.username || url.password) {
    throw new CallbackSecurityError('回调 URL 不允许携带用户名/密码')
  }
  const host = url.hostname.toLowerCase()
  if (
    !options.allowPrivate &&
    (BLOCKED_HOSTS.has(host) || host.endsWith('.local') || host.endsWith('.internal'))
  ) {
    throw new CallbackSecurityError(`回调 URL 指向内网/元数据地址：${host}`)
  }
  if (!options.allowPrivate && isIP(host) && isPrivateAddress(host)) {
    throw new CallbackSecurityError(`回调 URL 指向私网地址：${host}`)
  }
  if (options.allowlist && options.allowlist.length > 0 && !hostAllowed(host, options.allowlist)) {
    throw new CallbackSecurityError(`回调 URL 不在 allowlist：${host}`)
  }
  return url
}

export async function assertSafeCallbackUrlResolved(
  raw: string,
  options: SafeUrlOptions & { resolve?: (host: string) => Promise<string[]> } = {},
): Promise<URL> {
  const url = assertSafeCallbackUrl(raw, options)
  if (options.allowPrivate) return url
  const host = url.hostname
  if (isIP(host)) return url
  const addresses = await (options.resolve ?? defaultResolve)(host)
  if (addresses.length === 0) {
    throw new CallbackSecurityError(`回调 URL 无法解析：${host}`)
  }
  for (const address of addresses) {
    if (isPrivateAddress(address)) {
      throw new CallbackSecurityError(`回调 URL 解析到私网地址：${host} → ${address}`)
    }
  }
  return url
}

async function defaultResolve(host: string): Promise<string[]> {
  const rows = await lookup(host, { all: true })
  return rows.map((row) => row.address)
}

export function signJobCallback(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

export function verifyJobCallback(
  secret: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  const expected = signJobCallback(secret, timestamp, body)
  const left = Buffer.from(expected, 'utf8')
  const right = Buffer.from(signature, 'utf8')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export type CallbackOutcome = 'delivered' | 'retryable' | 'permanent' | 'skipped'

export function classifyCallbackStatus(status: number): CallbackOutcome {
  if (status >= 200 && status < 300) return 'delivered'
  if (status === 408 || status === 429 || status >= 500) return 'retryable'
  return 'permanent'
}

export interface CallbackDeliveryResult {
  outcome: CallbackOutcome
  attempts: number
  status?: number
  error?: string
}

export interface JobCallbackOptions extends SafeUrlOptions {
  maxAttempts?: number
  timeoutMs?: number
  retryBaseMs?: number
  fetcher?: typeof fetch
  resolve?: (host: string) => Promise<string[]>
}

/**
 * 外部回调：HMAC 签名 + 2xx 判定 + 重试 + SSRF 防护。
 *
 * 回调失败不改变任务业务结果；`callbackStatus` 单独记录，可手动重放。
 */
@Injectable()
export class JobCallbackService {
  constructor(private readonly queue?: JobQueue) {}

  async deliver(
    job: JobRecord,
    options: JobCallbackOptions = {},
  ): Promise<CallbackDeliveryResult> {
    if (!job.callbackUrl) return { outcome: 'skipped', attempts: 0 }

    const maxAttempts = Math.max(1, options.maxAttempts ?? 3)
    const timeoutMs = options.timeoutMs ?? 10_000
    const retryBaseMs = options.retryBaseMs ?? 1_000
    const fetcher = options.fetcher ?? fetch
    let last: CallbackDeliveryResult = { outcome: 'retryable', attempts: 0 }

    let url: URL
    try {
      url = await assertSafeCallbackUrlResolved(job.callbackUrl, options)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.queue?.updateCallback(job.id, 'blocked', 0, { error: message })
      return { outcome: 'permanent', attempts: 0, error: message }
    }

    const secret = job.callbackSecretRef ? process.env[job.callbackSecretRef] : undefined
    if (!secret) {
      const error = `回调密钥未配置：${job.callbackSecretRef ?? '(empty)'}`
      await this.queue?.updateCallback(job.id, 'failed', 0, { error })
      return { outcome: 'permanent', attempts: 0, error }
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const timestamp = String(Math.floor(Date.now() / 1000))
      const body = JSON.stringify({
        jobId: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        result: job.result,
        error: job.error,
        finishedAt: job.finishedAt,
      })
      const signature = signJobCallback(secret, timestamp, body)
      try {
        const response = await fetcher(url.toString(), {
          method: 'POST',
          redirect: 'manual',
          headers: {
            'content-type': 'application/json',
            'x-job-signature': signature,
            'x-job-timestamp': timestamp,
          },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        })
        const outcome = classifyCallbackStatus(response.status)
        last = { outcome, attempts: attempt, status: response.status }
        if (outcome === 'delivered') {
          await this.queue?.updateCallback(job.id, 'delivered', attempt, {
            status: response.status,
          })
          return last
        }
        if (outcome === 'permanent') {
          await this.queue?.updateCallback(job.id, 'failed', attempt, {
            status: response.status,
          })
          return last
        }
      } catch (error) {
        last = {
          outcome: 'retryable',
          attempts: attempt,
          error: error instanceof Error ? error.message : String(error),
        }
      }
      if (attempt < maxAttempts) {
        await sleep(retryBaseMs * Math.pow(2, attempt - 1))
      }
    }

    await this.queue?.updateCallback(job.id, 'failed', last.attempts, {
      error: last.error ?? `HTTP ${last.status ?? 'unknown'}`,
    })
    return last
  }

  /** 管理面手动重放：重新投递一次（仍受 SSRF/签名约束）。 */
  async replay(job: JobRecord, options: JobCallbackOptions = {}): Promise<CallbackDeliveryResult> {
    return this.deliver(job, { ...options, maxAttempts: 1 })
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    timer.unref?.()
  })
}
