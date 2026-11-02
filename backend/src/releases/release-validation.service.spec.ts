process.env.RELEASE_G4_RUN_TESTS = 'false'

import { ReleaseValidationService } from './release-validation.service'

describe('ReleaseValidationService', () => {
  const blueprints = { compile: jest.fn(async () => ({ id: 'ir' })) }
  const evalService = {
    gate: jest.fn((input: { suite: string; passed: number; failed: number }) =>
      input.suite === 'injection' && input.failed > 0
        ? { ok: false, reasons: ['注入套件通过率必须为 100%'] }
        : { ok: true, reasons: [] },
    ),
  }
  const service = new ReleaseValidationService(blueprints as never, evalService as never)

  it('fails when migration has no rollback plan', async () => {
    const result = await service.validate({
      proposal: {
        type: 'data',
        areas: ['data'],
        diff: {},
        risk: { migration: true },
        testPlan: { unit: ['x'] },
        rollbackPlan: {},
      },
    })
    expect(result.ok).toBe(false)
    expect(result.gates.G3.status).toBe('failed')
  })

  it('fails G5 when injection suite has failures', async () => {
    const result = await service.validate({
      proposal: {
        type: 'agent',
        areas: ['agent'],
        diff: {},
        risk: { agentBehaviorChange: true },
        testPlan: { unit: ['x'] },
        rollbackPlan: { strategy: 'deactivate-release' },
      },
      eval: { suite: 'injection', passed: 9, failed: 1 },
    })
    expect(result.ok).toBe(false)
    expect(result.gates.G5.status).toBe('failed')
  })
})


describe('ReleaseValidationService model change', () => {
  it('requires an eval run for the new modelId', async () => {
    const evalService = {
      listRuns: jest.fn(async () => [{ modelId: 'old-model', suite: 'faq', passed: 10, failed: 0 }]),
      gate: jest.fn(() => ({ ok: true, reasons: [] })),
    }
    const service = new ReleaseValidationService({ compile: jest.fn() } as never, evalService as never)
    const result = await service.validate({
      proposal: {
        type: 'agent',
        areas: ['agent'],
        diff: {},
        risk: { agentBehaviorChange: true },
        testPlan: { unit: ['x'] },
        rollbackPlan: { strategy: 'deactivate-release' },
      },
      releaseId: 'r1',
      modelId: 'new-model',
    })
    expect(result.ok).toBe(false)
    expect(result.gates.G5.status).toBe('failed')
  })
})
