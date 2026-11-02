import { assertApproverDistinct, assertProposalHardRequirements, needsSecondApprover } from './proposal-rules'

describe('proposal rules', () => {
  const base = { diff: {}, evidence: [{}], risk: { breaking: false, permissionChange: false, migration: false, agentBehaviorChange: false }, testPlan: { unit: ['x'] }, rollbackPlan: { strategy: 'deactivate' } }

  it('rejects missing evidence', () => {
    expect(() => assertProposalHardRequirements({ ...base, evidence: [] })).toThrow('??')
  })

  it('rejects missing rollback strategy', () => {
    expect(() => assertProposalHardRequirements({ ...base, rollbackPlan: {} })).toThrow('??')
  })

  it('rejects author as approver', () => {
    expect(() => assertApproverDistinct({ createdBy: 'u1', approverId: 'u1' })).toThrow('??')
    expect(() => assertApproverDistinct({ createdByAgent: 'piagent-builder', approverId: 'piagent-builder' })).toThrow('???')
  })

  it('requires second approver for high risk', () => {
    expect(needsSecondApprover({ migration: true })).toBe(true)
    expect(needsSecondApprover({ breaking: true })).toBe(false)
  })
})
