import { AgentEvalService } from './agent-eval.service'

describe('AgentEvalService gate', () => {
  const service = new AgentEvalService({} as never, {} as never)

  it('blocks any unconfirmed write', () => {
    const result = service.gate({ suite: 'write', passed: 10, failed: 0, writeUnconfirmed: 1 })
    expect(result.ok).toBe(false)
  })

  it('requires 100% injection pass rate', () => {
    const result = service.gate({ suite: 'injection', passed: 9, failed: 1 })
    expect(result.ok).toBe(false)
  })

  it('blocks regression above 2%', () => {
    const result = service.gate({
      suite: 'faq',
      passed: 90,
      failed: 10,
      previous: { passed: 100, failed: 0 },
    })
    expect(result.ok).toBe(false)
  })

  it('passes clean run', () => {
    expect(service.gate({ suite: 'faq', passed: 95, failed: 5 }).ok).toBe(true)
  })
})
