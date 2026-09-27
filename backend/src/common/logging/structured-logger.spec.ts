import {
  collectLogs,
  log,
  logApprove,
  logImportMaster,
  logOutboxDelivery,
  logTransition,
  redactFields,
} from './structured-logger'

describe('structured-logger', () => {
  const previous = process.env.LOG_FORMAT

  afterEach(() => {
    if (previous === undefined) delete process.env.LOG_FORMAT
    else process.env.LOG_FORMAT = previous
  })

  it('LOG_FORMAT=json：一行可解析，含 ts/level/msg 与关键字段', () => {
    process.env.LOG_FORMAT = 'json'
    const lines = collectLogs(() => {
      logTransition({
        blueprintId: 'auto-parts-min',
        entity: 'SalesOrder',
        recordId: 'r1',
        from: 'draft',
        to: 'confirmed',
        version: 2,
      })
      logApprove({ ruleId: 'so-high-value', stepIndex: 0, role: 'owner', result: 'approved' })
      logImportMaster({ entity: 'Part', imported: 3, failed: 1, dryRun: false })
      logOutboxDelivery({
        eventId: 'evt-1',
        topic: 'blueprint.record.transitioned',
        outcome: 'failed',
        attempts: 2,
        lastError: 'subscriber-boom',
      })
    })
    expect(lines).toHaveLength(4)
    const parsed = lines.map((line) => JSON.parse(line) as Record<string, unknown>)
    expect(parsed[0]).toEqual(
      expect.objectContaining({
        level: 'info',
        msg: 'transition',
        blueprintId: 'auto-parts-min',
        entity: 'SalesOrder',
        recordId: 'r1',
        from: 'draft',
        to: 'confirmed',
        version: 2,
      }),
    )
    expect(typeof parsed[0].ts).toBe('string')
    expect(parsed[1]).toEqual(
      expect.objectContaining({
        msg: 'approve',
        ruleId: 'so-high-value',
        stepIndex: 0,
        role: 'owner',
        result: 'approved',
      }),
    )
    expect(parsed[2]).toEqual(
      expect.objectContaining({ msg: 'importMaster', imported: 3, failed: 1, dryRun: false }),
    )
    expect(parsed[3]).toEqual(
      expect.objectContaining({
        msg: 'outbox.failed',
        eventId: 'evt-1',
        attempts: 2,
        lastError: 'subscriber-boom',
      }),
    )
  })

  it('缺省 text：不是 JSON，但仍含关键字段', () => {
    delete process.env.LOG_FORMAT
    const lines = collectLogs(() => {
      log('info', 'transition', { entity: 'Part', from: 'active', to: 'obsolete' })
    })
    expect(lines).toHaveLength(1)
    expect(() => JSON.parse(lines[0])).toThrow()
    expect(lines[0]).toContain('INFO transition')
    expect(lines[0]).toContain('entity=Part')
    expect(lines[0]).toContain('from=active')
  })

  it('不泄露敏感值：整份 data / 私钥不会进日志', () => {
    process.env.LOG_FORMAT = 'json'
    const lines = collectLogs(() => {
      log('info', 'transition', {
        entity: 'SalesOrder',
        data: { quantity: 9, secret: 'should-not-appear' },
        privatePem: '-----BEGIN PRIVATE KEY-----\nleaked\n-----END PRIVATE KEY-----',
        apiKey: 'sk-live-xxx',
        recordId: 'r1',
      })
    })
    const parsed = JSON.parse(lines[0]) as Record<string, unknown>
    expect(parsed.data).toBeUndefined()
    expect(parsed.privatePem).toBeUndefined()
    expect(parsed.apiKey).toBeUndefined()
    expect(parsed.recordId).toBe('r1')
    expect(JSON.stringify(parsed)).not.toContain('should-not-appear')
    expect(JSON.stringify(parsed)).not.toContain('BEGIN PRIVATE KEY')
    expect(JSON.stringify(parsed)).not.toContain('sk-live-xxx')
  })

  it('redactFields 去掉敏感键并截断 lastError', () => {
    const redacted = redactFields({
      lastError: 'x'.repeat(400),
      data: { hidden: true },
      attempts: 3,
    })
    expect(redacted.data).toBeUndefined()
    expect(redacted.attempts).toBe(3)
    expect(typeof redacted.lastError).toBe('string')
    expect((redacted.lastError as string).length).toBeLessThan(400)
  })
})
