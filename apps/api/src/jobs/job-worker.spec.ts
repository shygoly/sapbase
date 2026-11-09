import { JobWorkerService } from './job-worker'
import { JobTypeRegistry } from './job-types'
import type { JobRecord } from './job-types'

function job(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    organizationId: 'org-1',
    appInstallationId: null,
    type: 'test.ok',
    typeVersion: 1,
    status: 'running',
    priority: 0,
    payload: { value: 1 },
    result: null,
    error: null,
    progress: 0,
    idempotencyKey: null,
    attempts: 1,
    maxAttempts: 3,
    runAt: new Date(),
    startedAt: new Date(),
    finishedAt: null,
    leaseUntil: new Date(Date.now() + 60_000),
    workerId: 'w1',
    cancelRequested: false,
    callbackUrl: null,
    callbackSecretRef: null,
    callbackStatus: null,
    callbackAttempts: 0,
    createdBy: null,
    ...overrides,
  }
}

function fakeQueue(overrides: Record<string, jest.Mock> = {}) {
  return {
    recordAttempt: jest.fn(async () => undefined),
    progress: jest.fn(async () => undefined),
    appendEvent: jest.fn(async () => undefined),
    complete: jest.fn(async () => job()),
    fail: jest.fn(async () => job()),
    cancelRunning: jest.fn(async () => job()),
    isCancelRequested: jest.fn(async () => false),
    heartbeat: jest.fn(async () => true),
    ...overrides,
  }
}

function registryWith(
  handler: (ctx: unknown, payload: Record<string, unknown>) => Promise<unknown>,
  overrides: Record<string, unknown> = {},
) {
  const registry = new JobTypeRegistry()
  registry.register({
    type: 'test.ok',
    payloadSchema: { type: 'object' },
    handler: handler as never,
    timeoutMs: 100,
    ...overrides,
  } as never)
  return registry
}

describe('JobWorkerService.run', () => {
  it('成功 → complete + attempt succeeded + stage 事件', async () => {
    const queue = fakeQueue()
    const registry = registryWith(async () => ({ result: { ok: true }, progress: 50 }))
    const worker = new JobWorkerService(queue as never, registry)
    await worker.run(job())
    expect(queue.complete).toHaveBeenCalledWith('job-1', expect.any(String), { ok: true })
    expect(queue.recordAttempt).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'succeeded', attempt: 1 }),
    )
    expect(queue.appendEvent).toHaveBeenCalledWith('job-1', 'stage', { stage: 'succeeded' })
  })

  it('失败且未达上限 → queued 重试，记录 failed', async () => {
    const queue = fakeQueue()
    const registry = registryWith(async () => {
      throw new Error('boom')
    })
    const worker = new JobWorkerService(queue as never, registry)
    await worker.run(job({ attempts: 1, maxAttempts: 3 }))
    expect(queue.fail).toHaveBeenCalledWith(
      'job-1',
      expect.any(String),
      expect.objectContaining({ message: 'boom', timeout: false }),
      expect.objectContaining({ status: 'queued', runAt: expect.any(Date) }),
    )
    expect(queue.recordAttempt).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'failed' }),
    )
  })

  it('失败且已达上限 → dead（DLQ）', async () => {
    const queue = fakeQueue()
    const registry = registryWith(async () => {
      throw new Error('boom')
    })
    const worker = new JobWorkerService(queue as never, registry)
    await worker.run(job({ attempts: 3, maxAttempts: 3 }))
    expect(queue.fail).toHaveBeenCalledWith(
      'job-1',
      expect.any(String),
      expect.any(Object),
      { status: 'dead' },
    )
    expect(queue.appendEvent).toHaveBeenCalledWith('job-1', 'error', expect.any(Object))
  })

  it('超时 → timeout 失败并重试（未达上限）', async () => {
    const queue = fakeQueue()
    const registry = registryWith(async () => new Promise(() => undefined), {
      timeoutMs: 5,
    })
    const worker = new JobWorkerService(queue as never, registry)
    await worker.run(job({ attempts: 1, maxAttempts: 3 }))
    const failArgs = queue.fail.mock.calls[0] as unknown as [
      string,
      string,
      { message: string; timeout: boolean },
      { status: string },
    ]
    expect(failArgs[2]).toMatchObject({ timeout: true })
    expect(failArgs[3]).toEqual({ status: 'queued', runAt: expect.any(Date) })
    expect(queue.recordAttempt).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'timeout' }),
    )
  }, 2_000)

  it('取消请求 → cancelRunning，不执行 handler', async () => {
    const queue = fakeQueue({ isCancelRequested: jest.fn(async () => true) })
    const handler = jest.fn()
    const registry = registryWith(handler as never)
    const worker = new JobWorkerService(queue as never, registry)
    await worker.run(job())
    expect(handler).not.toHaveBeenCalled()
    expect(queue.cancelRunning).toHaveBeenCalledWith('job-1', expect.any(String))
  })

  it('未知类型 → dead，记录失败', async () => {
    const queue = fakeQueue()
    const registry = new JobTypeRegistry()
    const worker = new JobWorkerService(queue as never, registry)
    await worker.run(job({ type: 'missing.type' }))
    expect(queue.fail).toHaveBeenCalledWith(
      'job-1',
      expect.any(String),
      expect.objectContaining({ reason: 'unknown-type' }),
    )
  })

  it('progress/stage/log 写入事件', async () => {
    const queue = fakeQueue()
    const registry = registryWith(async (ctx: unknown) => {
      const context = ctx as {
        progress: (n: number) => Promise<void>
        stage: (s: string) => Promise<void>
        log: (m: string) => Promise<void>
      }
      await context.progress(42)
      await context.stage('scanning')
      await context.log('hello')
      return { result: { ok: true } }
    })
    const worker = new JobWorkerService(queue as never, registry)
    await worker.run(job())
    expect(queue.progress).toHaveBeenCalledWith('job-1', 42)
    expect(queue.appendEvent).toHaveBeenCalledWith('job-1', 'progress', { progress: 42 })
    expect(queue.appendEvent).toHaveBeenCalledWith('job-1', 'stage', { stage: 'scanning' })
    expect(queue.appendEvent).toHaveBeenCalledWith('job-1', 'log', { message: 'hello' })
  })
})
