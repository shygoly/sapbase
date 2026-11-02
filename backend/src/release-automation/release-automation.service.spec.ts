import { A2_ALLOWED_CHANGE_CLASSES, A2_FORBIDDEN_CHANGE_CLASSES, ReleaseAutomationService } from './release-automation.service'

describe('A2 whitelist', () => {
  it('allows only low-risk classes', () => {
    expect(A2_ALLOWED_CHANGE_CLASSES).toContain('copy')
    expect(A2_ALLOWED_CHANGE_CLASSES).toContain('knowledge_instruction')
    expect(A2_FORBIDDEN_CHANGE_CLASSES).toEqual(
      expect.arrayContaining(['data', 'flow', 'permission', 'agent', 'migration']),
    )
  })
})


describe('A2 eligibility and guardrails', () => {
  const service = new ReleaseAutomationService({} as never, {} as never, {} as never, {} as never)

  it('rejects structural change classes', () => {
    expect(() => service.assertEligible({ autonomy: 'A2', enabled: true } as never, ['data'])).toThrow()
  })

  it('rejects A1 and disabled policy', () => {
    expect(() => service.assertEligible({ autonomy: 'A1', enabled: true } as never, ['copy'])).toThrow()
    expect(() => service.assertEligible({ autonomy: 'A2', enabled: false } as never, ['copy'])).toThrow()
  })

  it('evaluates guardrail thresholds', () => {
    expect(service.evaluateGuardrails({ errorRate: 0.02 }, { errorRate: 0.01 })).toHaveLength(1)
    expect(service.evaluateGuardrails({ errorRate: 0.005 }, { errorRate: 0.01 })).toHaveLength(0)
  })
})


function makeService(policy: Record<string, unknown>, releases: Record<string, unknown> = {}) {
  const policies = {
    findOne: jest.fn(async () => policy),
    save: jest.fn(async (row: unknown) => row),
    find: jest.fn(async () => [policy]),
  }
  const runs = { create: jest.fn((row: unknown) => row), save: jest.fn(async (row: unknown) => row), find: jest.fn(async () => []) }
  const activations = { findOne: jest.fn(async () => null), save: jest.fn(async (row: unknown) => row) }
  const service = new ReleaseAutomationService(policies as never, runs as never, activations as never, releases as never)
  return { service, policies, runs, activations }
}

describe('A2 execution', () => {
  it('publishes with actorAgent null and records a run', async () => {
    const releases = { publish: jest.fn(async () => ({ id: 'r1', channel: 'canary' })) }
    const { service, runs } = makeService({ id: 'p1', autonomy: 'A2', enabled: true, canaryStages: [5, 25, 100] }, releases)
    await service.publish({ organizationId: 'o1', appKey: 'erp', changeClasses: ['copy'], version: '1.0.1', manifest: {}, changelog: { 'zh-CN': [{}] } })
    expect(runs.save).toHaveBeenCalledWith(expect.objectContaining({ actorAgent: null }))
  })

  it('rejects automatic rollback when disabled', async () => {
    const { service } = makeService({ id: 'p1', autonomy: 'A2', enabled: true, autoRollbackEnabled: false, guardrails: {} })
    await expect(service.rollback({ organizationId: 'o1', appKey: 'erp', appInstallationId: 'i1', releaseId: 'r1', reason: 'x' })).rejects.toThrow()
  })

  it('rejects automatic rollback without thresholds', async () => {
    const { service } = makeService({ id: 'p1', autonomy: 'A2', enabled: true, autoRollbackEnabled: true, guardrails: {} })
    await expect(service.rollback({ organizationId: 'o1', appKey: 'erp', appInstallationId: 'i1', releaseId: 'r1', reason: 'x' })).rejects.toThrow()
  })

  it('disables policy after a review with clean=false', async () => {
    const { service, policies } = makeService({ id: 'p1', autonomy: 'A2', enabled: true, consecutiveCleanRuns: 3 })
    const saved = await service.review({ organizationId: 'o1', appKey: 'erp', reviewedBy: 'u1', clean: false })
    expect(saved.enabled).toBe(false)
    expect(policies.save).toHaveBeenCalled()
  })

  it('quarterly audit confirms zero structural auto publishes', async () => {
    const { service } = makeService({ id: 'p1', autonomy: 'A2', enabled: true })
    const audit = await service.quarterlyAudit('o1')
    expect(audit.structuralAutoPublishes).toBe(0)
    expect(audit.ok).toBe(true)
  })
})
