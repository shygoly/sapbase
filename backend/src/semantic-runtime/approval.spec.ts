import {
  applyApprove,
  buildPendingSteps,
  chainStatusOf,
  currentPendingStep,
  isFullyApproved,
  toChainView,
} from './approval'

const RULE = {
  id: 'so-high-value',
  entity: 'SalesOrder',
  when: 'totalAmount > 100000',
  steps: [{ role: 'sales-manager' }, { role: 'gm' }],
}

describe('审批链纯逻辑', () => {
  it('建链后全是 pending；当前待审是第一步', () => {
    const steps = buildPendingSteps(RULE)
    expect(steps).toHaveLength(2)
    expect(chainStatusOf(steps)).toBe('pending')
    expect(currentPendingStep(steps)?.role).toBe('sales-manager')
    expect(isFullyApproved(steps)).toBe(false)
    expect(toChainView(RULE.id, steps).status).toBe('pending')
  })

  it('角色不符 → 拒，写明期望与实际', () => {
    const result = applyApprove(buildPendingSteps(RULE), 'finance-manager', 'u1', '2026-01-01T00:00:00Z')
    expect(result).toEqual({
      ok: false,
      reason: 'role-mismatch',
      expectedRole: 'sales-manager',
      actualRole: 'finance-manager',
    })
  })

  it('最后一步批完 → 全链 approved；已全批再批 → already-approved', () => {
    const first = applyApprove(buildPendingSteps(RULE), 'sales-manager', 'u1', '2026-01-01T00:00:00Z')
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.chainStatus).toBe('pending')
    const second = applyApprove(first.steps, 'gm', 'u2', '2026-01-02T00:00:00Z')
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.chainStatus).toBe('approved')
    expect(isFullyApproved(second.steps)).toBe(true)
    expect(applyApprove(second.steps, 'gm', 'u2', '2026-01-03T00:00:00Z')).toEqual({
      ok: false,
      reason: 'already-approved',
    })
  })

  it('负例：空链 / 已拒', () => {
    expect(applyApprove([], 'sales-manager', 'u1', '2026-01-01T00:00:00Z')).toEqual({
      ok: false,
      reason: 'not-found',
    })
    const rejected = buildPendingSteps(RULE).map((step, index) =>
      index === 0 ? { ...step, status: 'rejected' as const } : step,
    )
    expect(applyApprove(rejected, 'sales-manager', 'u1', '2026-01-01T00:00:00Z')).toEqual({
      ok: false,
      reason: 'already-rejected',
    })
  })
})
