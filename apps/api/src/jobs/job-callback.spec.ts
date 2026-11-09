import {
  assertSafeCallbackUrl,
  assertSafeCallbackUrlResolved,
  CallbackSecurityError,
  classifyCallbackStatus,
  JobCallbackService,
  signJobCallback,
  verifyJobCallback,
} from './job-callback'
import type { JobRecord } from './job-types'

function job(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    organizationId: 'org-1',
    appInstallationId: null,
    type: 'media.scan',
    typeVersion: 1,
    status: 'succeeded',
    priority: 0,
    payload: {},
    result: { ok: true },
    error: null,
    progress: 100,
    idempotencyKey: null,
    attempts: 1,
    maxAttempts: 3,
    runAt: new Date(),
    startedAt: new Date(),
    finishedAt: new Date(),
    leaseUntil: null,
    workerId: null,
    cancelRequested: false,
    callbackUrl: 'https://example.com/callback',
    callbackSecretRef: 'JOB_TEST_SECRET',
    callbackStatus: null,
    callbackAttempts: 0,
    createdBy: null,
    ...overrides,
  }
}

const RESOLVE = async () => ['93.184.216.34']

describe('callback signature', () => {
  it('签名可验证；篡改 body/timestamp 失败', () => {
    const secret = 's3cret'
    const timestamp = '1700000000'
    const body = '{"jobId":"j1"}'
    const signature = signJobCallback(secret, timestamp, body)
    expect(verifyJobCallback(secret, timestamp, body, signature)).toBe(true)
    expect(verifyJobCallback(secret, timestamp, `${body}x`, signature)).toBe(false)
    expect(verifyJobCallback(secret, '1700000001', body, signature)).toBe(false)
    expect(verifyJobCallback(secret, timestamp, body, 'bad')).toBe(false)
  })
})

describe('callback SSRF guard', () => {
  it.each([
    'http://example.com/cb',
    'https://127.0.0.1/cb',
    'https://10.0.0.1/cb',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost/cb',
    'https://metadata.google.internal/cb',
    'https://user:pass@example.com/cb',
  ])('拒绝 %s', (url) => {
    expect(() => assertSafeCallbackUrl(url)).toThrow(CallbackSecurityError)
  })

  it('allowlist 只放行列出的 host', () => {
    expect(() =>
      assertSafeCallbackUrl('https://evil.example/cb', { allowlist: ['hooks.example.com'] }),
    ).toThrow(/allowlist/)
    expect(() =>
      assertSafeCallbackUrl('https://hooks.example.com/cb', {
        allowlist: ['hooks.example.com'],
      }),
    ).not.toThrow()
    expect(() =>
      assertSafeCallbackUrl('https://a.hooks.example.com/cb', {
        allowlist: ['*.hooks.example.com'],
      }),
    ).not.toThrow()
  })

  it('DNS 解析到私网地址也拒绝', async () => {
    await expect(
      assertSafeCallbackUrlResolved('https://rebind.example/cb', {
        resolve: async () => ['10.1.2.3'],
      }),
    ).rejects.toThrow(/私网地址/)
  })

  it('http 仅在 allowHttp 时允许', () => {
    expect(() =>
      assertSafeCallbackUrl('http://localhost:3000/cb', {
        allowHttp: true,
        allowPrivate: true,
      }),
    ).not.toThrow()
  })
})

describe('callback status classification', () => {
  it('2xx/408/429/5xx/其他 4xx', () => {
    expect(classifyCallbackStatus(204)).toBe('delivered')
    expect(classifyCallbackStatus(408)).toBe('retryable')
    expect(classifyCallbackStatus(429)).toBe('retryable')
    expect(classifyCallbackStatus(503)).toBe('retryable')
    expect(classifyCallbackStatus(400)).toBe('permanent')
    expect(classifyCallbackStatus(302)).toBe('permanent')
  })
})

describe('JobCallbackService', () => {
  beforeEach(() => {
    process.env.JOB_TEST_SECRET = 's3cret'
  })

  afterEach(() => {
    delete process.env.JOB_TEST_SECRET
  })

  it('2xx → delivered，带签名头', async () => {
    const updateCallback = jest.fn(async () => undefined)
    const fetcher = jest.fn(async () => ({ status: 200 }) as Response)
    const service = new JobCallbackService({ updateCallback } as never)
    const result = await service.deliver(job(), {
      fetcher: fetcher as never,
      resolve: RESOLVE,
      maxAttempts: 1,
    })
    expect(result).toMatchObject({ outcome: 'delivered', attempts: 1, status: 200 })
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://example.com/callback')
    expect(init.redirect).toBe('manual')
    expect((init.headers as Record<string, string>)['x-job-signature']).toMatch(/^[a-f0-9]{64}$/)
    expect((init.headers as Record<string, string>)['x-job-timestamp']).toMatch(/^\d+$/)
    expect(updateCallback).toHaveBeenCalledWith('job-1', 'delivered', 1, { status: 200 })
  })

  it('5xx 重试后成功', async () => {
    const updateCallback = jest.fn(async () => undefined)
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({ status: 503 } as Response)
      .mockResolvedValueOnce({ status: 200 } as Response)
    const service = new JobCallbackService({ updateCallback } as never)
    const result = await service.deliver(job(), {
      fetcher: fetcher as never,
      resolve: RESOLVE,
      maxAttempts: 2,
      retryBaseMs: 1,
    })
    expect(result).toMatchObject({ outcome: 'delivered', attempts: 2 })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('4xx 不重试', async () => {
    const updateCallback = jest.fn(async () => undefined)
    const fetcher = jest.fn(async () => ({ status: 400 }) as Response)
    const service = new JobCallbackService({ updateCallback } as never)
    const result = await service.deliver(job(), {
      fetcher: fetcher as never,
      resolve: RESOLVE,
      maxAttempts: 3,
    })
    expect(result).toMatchObject({ outcome: 'permanent', attempts: 1 })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(updateCallback).toHaveBeenCalledWith('job-1', 'failed', 1, { status: 400 })
  })

  it('私网 URL → blocked，不发起请求', async () => {
    const updateCallback = jest.fn(async () => undefined)
    const fetcher = jest.fn()
    const service = new JobCallbackService({ updateCallback } as never)
    const result = await service.deliver(
      job({ callbackUrl: 'https://127.0.0.1/cb' }),
      { fetcher: fetcher as never, maxAttempts: 1 },
    )
    expect(result.outcome).toBe('permanent')
    expect(fetcher).not.toHaveBeenCalled()
    expect(updateCallback).toHaveBeenCalledWith('job-1', 'blocked', 0, expect.anything())
  })

  it('缺密钥 → failed，不发起请求', async () => {
    delete process.env.JOB_TEST_SECRET
    const updateCallback = jest.fn(async () => undefined)
    const fetcher = jest.fn()
    const service = new JobCallbackService({ updateCallback } as never)
    const result = await service.deliver(job(), {
      fetcher: fetcher as never,
      resolve: RESOLVE,
      maxAttempts: 1,
    })
    expect(result.outcome).toBe('permanent')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
