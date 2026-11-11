import {
  assertApproverDistinct,
  assertEvolutionBinding,
  assertProposalHardRequirements,
} from './proposal-rules'

const baseProposal = {
  diff: { object: { change: 'field' } },
  evidence: [{ type: 'feedback', id: 'f1' }],
  risk: {
    breaking: false,
    permissionChange: false,
    migration: false,
    agentBehaviorChange: false,
  },
  testPlan: { unit: ['x.spec.ts'] },
  rollbackPlan: { strategy: 'deactivate-release' },
}

describe('proposal rules', () => {
  it('完整提议通过硬性要求', () => {
    expect(() => assertProposalHardRequirements(baseProposal)).not.toThrow()
  })

  it('缺证据/风险字段/回退计划拒绝', () => {
    expect(() =>
      assertProposalHardRequirements({ ...baseProposal, evidence: [] }),
    ).toThrow(/证据/)
    expect(() =>
      assertProposalHardRequirements({
        ...baseProposal,
        risk: { ...baseProposal.risk, migration: undefined } as never,
      }),
    ).toThrow(/risk.migration/)
    expect(() =>
      assertProposalHardRequirements({ ...baseProposal, rollbackPlan: {} }),
    ).toThrow(/回退/)
  })

  it('实例演进必须绑定 platformVersion + evolutionScope', () => {
    expect(() => assertEvolutionBinding({})).toThrow(/platformVersion/)
    expect(() =>
      assertEvolutionBinding({ platformVersion: '1.0.0' }),
    ).toThrow(/evolutionScope/)
    expect(() =>
      assertEvolutionBinding({
        platformVersion: '1.0.0',
        evolutionScope: ['object', 'unknown'],
      }),
    ).toThrow(/未知范围/)
    expect(() =>
      assertEvolutionBinding({
        platformVersion: '1.0.0',
        evolutionScope: ['field', 'form'],
      }),
    ).not.toThrow()
  })

  it('作者/智能体不能批准自己的提议', () => {
    expect(() =>
      assertApproverDistinct({ createdBy: 'u1', approverId: 'u1' }),
    ).toThrow(/作者/)
    expect(() =>
      assertApproverDistinct({ createdByAgent: 'agent-1', approverId: 'agent-1' }),
    ).toThrow(/智能体/)
    expect(() =>
      assertApproverDistinct({ createdBy: 'u1', approverId: 'u2' }),
    ).not.toThrow()
  })
})
