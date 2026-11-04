import {
  assembleSuggestedTransitions,
  assembleTransitionHistory,
  normalizeLegacyHistory,
} from './record-history'

describe('assembleTransitionHistory', () => {
  it('按时间升序组装；from/to 优先取 changes', () => {
    const items = assembleTransitionHistory([
      {
        timestamp: '2026-09-26T10:00:00.000Z',
        actor: 'u2',
        changes: { from: 'confirmed', to: 'shipped' },
        metadata: { from: 'ignored', to: 'ignored' },
      },
      {
        timestamp: '2026-09-26T09:00:00.000Z',
        actor: 'u1',
        changes: { from: 'draft', to: 'confirmed' },
      },
    ])
    expect(items).toEqual([
      { at: '2026-09-26T09:00:00.000Z', actor: 'u1', from: 'draft', to: 'confirmed' },
      { at: '2026-09-26T10:00:00.000Z', actor: 'u2', from: 'confirmed', to: 'shipped' },
    ])
  })

  it('空输入 → []（无迁移历史不是错误）', () => {
    expect(assembleTransitionHistory([])).toEqual([])
  })

  it('负例：缺 from/to 的行丢弃；空 actor 回落 unknown；changes 缺则读 metadata', () => {
    const items = assembleTransitionHistory([
      { timestamp: '2026-09-26T09:00:00.000Z', actor: '', metadata: { from: 'draft', to: 'confirmed' } },
      { timestamp: '2026-09-26T09:01:00.000Z', actor: 'u1', changes: { from: 'draft' } },
      { timestamp: '2026-09-26T09:02:00.000Z', actor: 'u1', changes: { to: 'shipped' } },
    ])
    expect(items).toEqual([
      { at: '2026-09-26T09:00:00.000Z', actor: 'unknown', from: 'draft', to: 'confirmed' },
    ])
  })
})

describe('assembleSuggestedTransitions', () => {
  it('无审批或已全批 → requiresApproval=false，不含 pendingApproval', () => {
    expect(assembleSuggestedTransitions(['confirmed'], [])).toEqual([
      { to: 'confirmed', requiresApproval: false },
    ])
    expect(
      assembleSuggestedTransitions(['confirmed'], [
        { ruleId: 'so-high-value', applies: true, fullyApproved: true, pendingRole: 'sales-manager' },
      ]),
    ).toEqual([{ to: 'confirmed', requiresApproval: false }])
  })

  it('when 为真且链未全批 → 每个目标都带 pendingApproval', () => {
    expect(
      assembleSuggestedTransitions(['confirmed', 'ghost'], [
        { ruleId: 'so-high-value', applies: true, fullyApproved: false, pendingRole: 'sales-manager' },
      ]),
    ).toEqual([
      {
        to: 'confirmed',
        requiresApproval: true,
        pendingApproval: { ruleId: 'so-high-value', role: 'sales-manager' },
      },
      {
        to: 'ghost',
        requiresApproval: true,
        pendingApproval: { ruleId: 'so-high-value', role: 'sales-manager' },
      },
    ])
  })

  it('负例：when 为假 / 无合法目标 → 不要求审批 / 空列表', () => {
    expect(
      assembleSuggestedTransitions(['confirmed'], [
        { ruleId: 'so-high-value', applies: false, fullyApproved: false, pendingRole: 'sales-manager' },
      ]),
    ).toEqual([{ to: 'confirmed', requiresApproval: false }])
    expect(
      assembleSuggestedTransitions([], [
        { ruleId: 'so-high-value', applies: true, fullyApproved: false, pendingRole: 'sales-manager' },
      ]),
    ).toEqual([])
  })
})

describe('normalizeLegacyHistory', () => {
  it('旧历史行按时间归一成 (from, to)', () => {
    expect(
      normalizeLegacyHistory([
        { fromState: 'confirmed', toState: 'shipped', timestamp: '2026-09-26T10:00:00.000Z' },
        { fromState: 'draft', toState: 'confirmed', timestamp: '2026-09-26T09:00:00.000Z' },
      ]),
    ).toEqual([
      { from: 'draft', to: 'confirmed' },
      { from: 'confirmed', to: 'shipped' },
    ])
  })

  it('负例：空列表 / 缺 fromState → 空或空字符串 from', () => {
    expect(normalizeLegacyHistory([])).toEqual([])
    expect(normalizeLegacyHistory([{ toState: 'confirmed' }])).toEqual([{ from: '', to: 'confirmed' }])
  })
})
