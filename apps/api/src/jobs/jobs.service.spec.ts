import { ForbiddenException, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common'
import { JobTypeRegistry } from './job-types'
import { JobsService } from './jobs.service'
import type { JobRecord } from './job-types'

function job(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    organizationId: 'org-1',
    appInstallationId: null,
    type: 'media.scan',
    typeVersion: 1,
    status: 'queued',
    priority: 0,
    payload: { assetId: 'a1' },
    result: null,
    error: null,
    progress: 0,
    idempotencyKey: null,
    attempts: 0,
    maxAttempts: 3,
    runAt: new Date(),
    startedAt: null,
    finishedAt: null,
    leaseUntil: null,
    workerId: null,
    cancelRequested: false,
    callbackUrl: null,
    callbackSecretRef: null,
    callbackStatus: null,
    callbackAttempts: 0,
    createdBy: null,
    ...overrides,
  }
}

function registry() {
  const registry = new JobTypeRegistry()
  registry.register({
    type: 'media.scan',
    payloadSchema: {
      type: 'object',
      required: ['assetId'],
      properties: { assetId: { type: 'string' } },
      additionalProperties: false,
    },
    handler: async () => ({ result: { ok: true } }),
  })
  return registry
}

function queue(overrides: Record<string, jest.Mock> = {}) {
  return {
    enqueue: jest.fn(async () => ({ job: job(), created: true })),
    list: jest.fn(async () => ({ items: [], total: 0 })),
    get: jest.fn(async () => job()),
    cancel: jest.fn(async () => ({ job: job({ status: 'cancelled' }), cancelledImmediately: true })),
    retryDead: jest.fn(async () => job({ status: 'queued' })),
    events: jest.fn(async () => []),
    ...overrides,
  }
}

function service(overrides: { queue?: ReturnType<typeof queue>; registry?: JobTypeRegistry } = {}) {
  const q = overrides.queue ?? queue()
  const callbacks = {
    replay: jest.fn(async () => ({ outcome: 'delivered', attempts: 1 })),
  }
  return {
    service: new JobsService(q as never, overrides.registry ?? registry(), callbacks as never),
    queue: q,
    callbacks,
  }
}

const ACTOR = { userId: 'u1', permissions: ['job:media.scan:create', 'jobs:read'] }

describe('JobsService', () => {
  it('创建：缺少类型权限 → 403', async () => {
    const { service: jobs } = service()
    await expect(
      jobs.create('org-1', { userId: 'u1', permissions: ['jobs:read'] }, {
        type: 'media.scan',
        payload: { assetId: 'a1' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('创建：未知类型 → 未知类型错误', async () => {
    const { service: jobs } = service()
    await expect(
      jobs.create('org-1', { ...ACTOR, permissions: ['jobs:manage'] }, {
        type: 'missing.type',
        payload: {},
      }),
    ).rejects.toThrow(/未知任务类型/)
  })

  it('创建：payload 非法 → 400', async () => {
    const { service: jobs } = service()
    await expect(
      jobs.create('org-1', ACTOR, { type: 'media.scan', payload: {} }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('创建：payload 过大 → 400', async () => {
    const { service: jobs } = service()
    await expect(
      jobs.create('org-1', ACTOR, {
        type: 'media.scan',
        payload: { assetId: 'a'.repeat(70 * 1024) },
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('创建：回调 URL 私网 → 400', async () => {
    const { service: jobs } = service()
    await expect(
      jobs.create('org-1', ACTOR, {
        type: 'media.scan',
        payload: { assetId: 'a1' },
        callbackUrl: 'https://127.0.0.1/cb',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('创建：合法请求入队，幂等键透传', async () => {
    const { service: jobs, queue: q } = service()
    await jobs.create('org-1', ACTOR, {
      type: 'media.scan',
      payload: { assetId: 'a1' },
      idempotencyKey: 'idem-1',
    })
    expect(q.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        type: 'media.scan',
        idempotencyKey: 'idem-1',
        payload: { assetId: 'a1' },
      }),
    )
  })

  it('查询：不存在 → 404', async () => {
    const q = queue({ get: jest.fn(async () => null) })
    const { service: jobs } = service({ queue: q })
    await expect(jobs.get('org-1', 'missing')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('取消：不可取消 → 404', async () => {
    const q = queue({ cancel: jest.fn(async () => null) })
    const { service: jobs } = service({ queue: q })
    await expect(jobs.cancel('org-1', 'missing', ACTOR)).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('DLQ 重放：非 dead → 409', async () => {
    const q = queue({ retryDead: jest.fn(async () => null) })
    const { service: jobs } = service({ queue: q })
    await expect(jobs.retryDead('org-1', 'job-1', ACTOR)).rejects.toBeInstanceOf(
      ConflictException,
    )
  })

  it('事件：先确认任务存在再查 afterSeq', async () => {
    const q = queue({ events: jest.fn(async () => [{ seq: 2 }]) })
    const { service: jobs } = service({ queue: q })
    await expect(jobs.events('org-1', 'job-1', 1)).resolves.toEqual([{ seq: 2 }])
    expect(q.events).toHaveBeenCalledWith('org-1', 'job-1', 1)
  })

  it('回调重放：无回调 URL → 409', async () => {
    const { service: jobs } = service()
    await expect(jobs.replayCallback('org-1', 'job-1', ACTOR)).rejects.toBeInstanceOf(
      ConflictException,
    )
  })
})
