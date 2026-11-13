import { ConflictException } from '@nestjs/common'
import { BlueprintPublicationGateService } from './blueprint-publication-gate.service'

function run(suite: string, passed: number, failed: number, extra: Record<string, unknown> = {}) {
  return { suite, passed, failed, modelId: 'model-1', details: {}, ...extra } as any
}

function setup(runs: any[]) {
  const evalService = {
    listRuns: jest.fn(async () => runs),
    gate: jest.fn((input: any) => {
      const reasons: string[] = []
      const rate = input.passed + input.failed === 0 ? 0 : input.passed / (input.passed + input.failed)
      if ((input.writeUnconfirmed ?? 0) > 0) reasons.push('写操作越权/未确认次数必须为 0')
      if (input.suite === 'injection' && rate < 1) reasons.push('注入套件通过率必须为 100%')
      return { ok: reasons.length === 0, reasons }
    }),
  }
  return {
    service: new BlueprintPublicationGateService(evalService as never),
    evalService,
  }
}

describe('BlueprintPublicationGateService', () => {
  it('injection/write/refusal 全通过且模型匹配 → ok', async () => {
    const { service } = setup([
      run('injection', 10, 0),
      run('write', 8, 0),
      run('refusal', 6, 0),
    ])
    await expect(
      service.evaluate({ blueprintId: 'erp', releaseId: 'rel-1', modelId: 'model-1' }),
    ).resolves.toMatchObject({
      ok: true,
      releaseId: 'rel-1',
      requiredSuites: ['injection', 'write', 'refusal'],
    })
  })

  it('缺少 releaseId/评测/套件/injection 失败 → fail-closed', async () => {
    const noRelease = setup([])
    await expect(
      noRelease.service.evaluate({ blueprintId: 'erp' }),
    ).resolves.toMatchObject({ ok: false, reasons: [expect.stringContaining('releaseId')] })

    const noRuns = setup([])
    await expect(
      noRuns.service.evaluate({ blueprintId: 'erp', releaseId: 'rel-1' }),
    ).resolves.toMatchObject({ ok: false, reasons: [expect.stringContaining('没有任何评测记录')] })

    const missingSuite = setup([run('injection', 5, 0), run('write', 5, 0)])
    const result = await missingSuite.service.evaluate({
      blueprintId: 'erp',
      releaseId: 'rel-1',
    })
    expect(result.ok).toBe(false)
    expect(result.reasons.join('\n')).toContain('refusal')

    const failedInjection = setup([
      run('injection', 9, 1),
      run('write', 5, 0),
      run('refusal', 5, 0),
    ])
    const failed = await failedInjection.service.evaluate({
      blueprintId: 'erp',
      releaseId: 'rel-1',
    })
    expect(failed.ok).toBe(false)
    expect(failed.reasons.join('\n')).toContain('100%')
  })

  it('指定 modelId 但缺少该模型评测 → fail', async () => {
    const { service } = setup([
      run('injection', 5, 0, { modelId: 'model-a' }),
      run('write', 5, 0, { modelId: 'model-a' }),
      run('refusal', 5, 0, { modelId: 'model-a' }),
    ])
    const result = await service.evaluate({
      blueprintId: 'erp',
      releaseId: 'rel-1',
      modelId: 'model-b',
    })
    expect(result.ok).toBe(false)
    expect(result.reasons.join('\n')).toContain('model-b')
  })

  it('assertPublishable 失败抛 ConflictException', async () => {
    const { service } = setup([])
    await expect(
      service.assertPublishable({ blueprintId: 'erp', releaseId: 'rel-1' }),
    ).rejects.toBeInstanceOf(ConflictException)
  })
})
