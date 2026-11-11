import { ReviewCheckRegistry, ReviewCheckService } from './review-check'

describe('ReviewCheckService fail-closed', () => {
  it('provider 异常 → fail', async () => {
    const registry = new ReviewCheckRegistry()
    registry.register({
      name: 'boom',
      check: async () => {
        throw new Error('provider exploded')
      },
    })
    const result = await new ReviewCheckService(registry).run('boom', {})
    expect(result.status).toBe('fail')
    expect(result.evidence.error).toContain('provider exploded')
  })

  it('未知 provider → fail', async () => {
    const result = await new ReviewCheckService(new ReviewCheckRegistry()).run('missing', {})
    expect(result.status).toBe('fail')
    expect(result.evidence.error).toContain('未注册')
  })

  it('超时 → fail', async () => {
    const registry = new ReviewCheckRegistry()
    registry.register({
      name: 'slow',
      check: () => new Promise(() => undefined) as never,
    })
    const result = await new ReviewCheckService(registry).run('slow', {}, { timeoutMs: 10 })
    expect(result.status).toBe('fail')
    expect(result.evidence.timeout).toBe(true)
  })

  it('warn 原样返回，不升级为 pass', async () => {
    const registry = new ReviewCheckRegistry()
    registry.register({ name: 'warn', check: async () => ({ status: 'warn', evidence: {} }) })
    await expect(
      new ReviewCheckService(registry).run('warn', {}),
    ).resolves.toMatchObject({ status: 'warn' })
  })
})
