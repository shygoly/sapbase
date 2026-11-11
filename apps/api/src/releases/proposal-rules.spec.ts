import { assertApproverDistinct, assertEvolutionBinding, assertProposalHardRequirements, needsSecondApprover } from './proposal-rules'

describe('proposal rules', () => {
  const base = { diff: {}, evidence: [{}], risk: { breaking: false, permissionChange: false, migration: false, agentBehaviorChange: false }, testPlan: { unit: ['x'] }, rollbackPlan: { strategy: 'deactivate' } }

  it('rejects missing evidence', () => {
    expect(() => assertProposalHardRequirements({ ...base, evidence: [] })).toThrow('证据')
  })

  it('rejects missing rollback strategy', () => {
    expect(() => assertProposalHardRequirements({ ...base, rollbackPlan: {} })).toThrow('回退计划')
  })

  it('rejects author as approver', () => {
    expect(() => assertApproverDistinct({ createdBy: 'u1', approverId: 'u1' })).toThrow('作者不能批准')
    expect(() => assertApproverDistinct({ createdByAgent: 'piagent-builder', approverId: 'piagent-builder' })).toThrow('智能体不能批准')
  })

  it('requires second approver for high risk', () => {
    expect(needsSecondApprover({ migration: true })).toBe(true)
    expect(needsSecondApprover({ breaking: true })).toBe(false)
  })

  it('requires evolution binding before approval', () => {
    expect(() => assertEvolutionBinding({})).toThrow('platformVersion')
    expect(() => assertEvolutionBinding({ platformVersion: '1.0.0' })).toThrow('evolutionScope')
    expect(() => assertEvolutionBinding({ platformVersion: '1.0.0', evolutionScope: ['unknown'] })).toThrow('未知范围')
    expect(() => assertEvolutionBinding({ platformVersion: '1.0.0', evolutionScope: ['field'] })).not.toThrow()
  })
})
