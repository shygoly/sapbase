import { JobTypeError, JobTypeRegistry } from './job-types'

function definition(overrides: Record<string, unknown> = {}) {
  return {
    type: 'media.scan',
    payloadSchema: {
      type: 'object',
      required: ['assetId'],
      properties: { assetId: { type: 'string' } },
      additionalProperties: false,
    },
    handler: async () => ({ result: { ok: true } }),
    ...overrides,
  } as never
}

describe('JobTypeRegistry', () => {
  it('注册合法类型后可按 type/version 取回', () => {
    const registry = new JobTypeRegistry()
    registry.register(definition())
    expect(registry.has('media.scan')).toBe(true)
    expect(registry.get('media.scan').type).toBe('media.scan')
    expect(registry.get('media.scan').typeVersion).toBe(1)
  })

  it('拒绝重复 type+version', () => {
    const registry = new JobTypeRegistry()
    registry.register(definition())
    expect(() => registry.register(definition())).toThrow(JobTypeError)
    expect(() => registry.register(definition())).toThrow(/重复注册/)
  })

  it('同 type 可注册不同版本', () => {
    const registry = new JobTypeRegistry()
    registry.register(definition())
    registry.register(definition({ typeVersion: 2 }))
    expect(registry.list()).toHaveLength(2)
    expect(registry.get('media.scan', 2).typeVersion).toBe(2)
  })

  it('拒绝非法 schema / 缺 handler / 非法版本/超时/并发/退避', () => {
    const registry = new JobTypeRegistry()
    expect(() => registry.register(definition({ payloadSchema: { type: 'string' } }))).toThrow(
      /payloadSchema/,
    )
    expect(() => registry.register(definition({ handler: undefined }))).toThrow(/handler/)
    expect(() => registry.register(definition({ typeVersion: 0 }))).toThrow(/版本非法/)
    expect(() => registry.register(definition({ timeoutMs: 0 }))).toThrow(/timeoutMs/)
    expect(() => registry.register(definition({ maxAttempts: 0 }))).toThrow(/maxAttempts/)
    expect(() => registry.register(definition({ concurrency: 0 }))).toThrow(/concurrency/)
    expect(() =>
      registry.register(definition({ backoff: { kind: 'linear', baseMs: 1 } })),
    ).toThrow(/backoff.kind/)
    expect(() =>
      registry.register(definition({ backoff: { kind: 'fixed', baseMs: 0 } })),
    ).toThrow(/baseMs/)
  })

  it('未知类型拒绝取用', () => {
    const registry = new JobTypeRegistry()
    expect(() => registry.get('missing')).toThrow(/未知任务类型/)
  })

  it('payload 按 schema 校验', () => {
    const registry = new JobTypeRegistry()
    registry.register(definition())
    expect(registry.validatePayload('media.scan', 1, { assetId: 'a1' })).toEqual({
      valid: true,
      errors: [],
    })
    expect(registry.validatePayload('media.scan', 1, {})).toMatchObject({ valid: false })
    expect(registry.validatePayload('media.scan', 1, { assetId: 'a1', extra: 1 })).toMatchObject({
      valid: false,
    })
    expect(registry.validatePayload('media.scan', 1, null as never)).toMatchObject({
      valid: false,
    })
  })
})
