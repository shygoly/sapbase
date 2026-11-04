// 接入层：调用成功/失败都要进审计，错误要映射成确定的 HTTP 状态码。
import { HttpException } from '@nestjs/common'
import { AtomicRuntimeController } from './atomic-runtime.controller'
import { AtomicRuntimeError, toHttpError } from './atomic-runtime.error'

function build(options: {
  invoke?: () => Promise<unknown>
  importManifest?: () => Promise<unknown>
  list?: () => Promise<unknown>
} = {}) {
  const audits: Array<Record<string, unknown>> = []
  const controller = new AtomicRuntimeController(
    {
      list: options.list ?? (async () => []),
      createContract: async (body: unknown) => body,
      importManifest:
        options.importManifest ??
        (async () => ({ imported: [], skipped: [], rejected: [] })),
    } as never,
    {
      invoke: options.invoke ?? (async () => ({ rows: 0, columns: {} })),
      engineName: () => 'v8',
    } as never,
    { create: async (log: Record<string, unknown>) => audits.push(log) } as never,
    { refresh: () => ({ list: { version: 0, issuedAt: '', revoked: [] }, loaded: false }) } as never,
  )
  return { controller, audits }
}

const REQ = {
  user: { id: 'u1', userId: 'u1', email: 'tester@example.com', organizationId: 'org-1' },
}

describe('AtomicRuntimeController', () => {
  it('调用成功后写审计（含模块哈希与耗时）', async () => {
    const { controller, audits } = build({
      invoke: async () => ({
        atomicType: 'available-inventory',
        contractVersion: '1.0.0',
        moduleSha256: 'a'.repeat(64),
        rows: 2,
        columns: { available: [7, 7] },
        total: 14,
        elapsedMs: 3,
        gateChecks: ['no-start-section'],
      }),
    })

    const result = (await controller.invoke(
      'available-inventory',
      { version: '^1.0.0', records: [{ onHand: 10 }] },
      REQ,
    )) as { total: number }

    expect(result.total).toBe(14)
    expect(audits).toHaveLength(1)
    expect(audits[0]).toMatchObject({
      action: 'atomic.invoke',
      resource: 'atomic-contract',
      actor: 'tester@example.com',
      status: 'success',
    })
    expect((audits[0].metadata as Record<string, unknown>).moduleSha256).toBe(
      'a'.repeat(64),
    )
  })

  it('调用失败也写审计，并把错误映射成 HTTP', async () => {
    const { controller, audits } = build({
      invoke: async () => {
        throw new AtomicRuntimeError('MODULE_REVOKED', '模块已吊销')
      },
    })

    let thrown: unknown
    try {
      await controller.invoke('available-inventory', { version: '*' }, REQ)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(HttpException)
    expect((thrown as HttpException).getStatus()).toBe(422)
    expect((thrown as HttpException).getResponse()).toMatchObject({
      code: 'MODULE_REVOKED',
    })
    expect(audits).toHaveLength(1)
    expect(audits[0]).toMatchObject({ status: 'failure' })
    expect((audits[0].metadata as Record<string, unknown>).reason).toContain('吊销')
  })

  it('非 AtomicRuntimeError 直接上抛（不伪装成原子失败）', async () => {
    const { controller, audits } = build({
      invoke: async () => {
        throw new Error('数据库连接断了')
      },
    })
    await expect(
      controller.invoke('available-inventory', { version: '*' }, REQ),
    ).rejects.toThrow('数据库连接断了')
    expect(audits[0]).toMatchObject({ status: 'failure' })
  })

  it('导入清单缺 path → 400', async () => {
    const { controller } = build()
    await expect(controller.importManifest({}, REQ)).rejects.toMatchObject({
      status: 400,
    })
  })

  it('导入清单带 path → 透传（含导入人）', async () => {
    const seen: Array<[string, string]> = []
    const { controller } = build({
      importManifest: async () => ({ imported: [], skipped: [], rejected: [] }),
    })
    // 用 spy 方式核验参数传递
    const withSpy = new AtomicRuntimeController(
      {
        importManifest: async (path: string, by: string) => {
          seen.push([path, by])
          return { imported: [], skipped: [], rejected: [] }
        },
      } as never,
      { engineName: () => 'v8' } as never,
      { create: async () => undefined } as never,
      { refresh: () => ({ list: { version: 0, issuedAt: '', revoked: [] }, loaded: false }) } as never,
    )
    void controller
    await withSpy.importManifest({ path: '/tmp/manifest.json' }, REQ)
    expect(seen).toEqual([['/tmp/manifest.json', 'tester@example.com']])
  })
})

describe('toHttpError 映射表', () => {
  it.each([
    ['MODULE_NOT_FOUND', 404],
    ['INVALID_INPUT', 400],
    ['MODULE_HASH_MISMATCH', 422],
    ['MODULE_REJECTED_BY_GATE', 422],
    ['MODULE_REVOKED', 422],
    ['OUTPUT_LIMIT_EXCEEDED', 422],
    ['ATOMIC_FAILED', 422],
    ['EXECUTION_TIMEOUT', 504],
    ['UNSUPPORTED_IMPLEMENTATION', 501],
  ] as const)('%s → %i', (code, status) => {
    expect(toHttpError(new AtomicRuntimeError(code, 'x')).statusCode).toBe(status)
  })
})
