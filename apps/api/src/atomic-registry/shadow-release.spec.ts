// 闸 4：证据门与状态机。三类情形都要有：能过、被拒、以及"安全动作不被拦"。
import { AdmissionStatus } from './atomic-implementation.entity'
import {
  checkPromotion,
  requiresReleaseEvidence,
  validateReleaseEvidence,
  type ReleaseEvidence,
} from './shadow-release'

const SOURCE_GATE = { language: 'rust', checks: ['no-build-rs'] }
const STATIC_GATE = { byteLength: 265, checks: ['import=env.memory(min=2,max=1024)'] }
const CLEAN_SHADOW = {
  parallelWith: 'available-inventory@1.0.0',
  startedAt: '2026-09-25T00:00:00Z',
  observedInvocations: 5000,
  differingResults: 0,
}
const CLEAN_CANARY = {
  startedAt: '2026-09-25T02:00:00Z',
  observedInvocations: 20000,
  differingResults: 0,
}

/** 一份"全链证据齐备"的记录 —— 正常晋升的正例。 */
const FULL_EVIDENCE: ReleaseEvidence = {
  sourceGate: SOURCE_GATE,
  staticGate: STATIC_GATE,
  reproducibleBuildRef: 'repro:rust:1.95.0:abc',
  shadow: CLEAN_SHADOW,
  canary: CLEAN_CANARY,
}

describe('正常晋升：逐级带证据，一路放行', () => {
  it.each([
    ['submitted → built', AdmissionStatus.SUBMITTED, AdmissionStatus.BUILT],
    ['built → tested', AdmissionStatus.BUILT, AdmissionStatus.TESTED],
    ['tested → shadow', AdmissionStatus.TESTED, AdmissionStatus.SHADOW],
    ['shadow → canary', AdmissionStatus.SHADOW, AdmissionStatus.CANARY],
    ['canary → active', AdmissionStatus.CANARY, AdmissionStatus.ACTIVE],
  ])('%s', (_label, from, to) => {
    const check = checkPromotion(from, to, FULL_EVIDENCE)
    expect(check.allowed).toBe(true)
    expect(check.missing).toBeUndefined()
  })
})

describe('不得跳级', () => {
  it.each([
    ['submitted → shadow', AdmissionStatus.SUBMITTED, AdmissionStatus.SHADOW],
    ['submitted → active', AdmissionStatus.SUBMITTED, AdmissionStatus.ACTIVE],
    ['tested → active', AdmissionStatus.TESTED, AdmissionStatus.ACTIVE],
    ['tested → canary', AdmissionStatus.TESTED, AdmissionStatus.CANARY],
  ])('%s → 拒绝（TRANSITION_NOT_ALLOWED），哪怕证据齐备', (_label, from, to) => {
    const check = checkPromotion(from, to, FULL_EVIDENCE)
    expect(check.allowed).toBe(false)
    expect(check.code).toBe('TRANSITION_NOT_ALLOWED')
  })

  it('同状态重入也被拒（不是"再确认一次"）', () => {
    expect(checkPromotion(AdmissionStatus.TESTED, AdmissionStatus.TESTED, FULL_EVIDENCE).allowed).toBe(
      false,
    )
  })

  it('回退也被拒，错误里给出正确路径（吊销 + 重新绑定）', () => {
    const check = checkPromotion(AdmissionStatus.ACTIVE, AdmissionStatus.TESTED, FULL_EVIDENCE)
    expect(check.allowed).toBe(false)
    expect(check.detail).toContain('吊销')
  })
})

describe('证据门：缺什么就列什么', () => {
  it('无证据晋 built → 缺 sourceGate', () => {
    const check = checkPromotion(AdmissionStatus.SUBMITTED, AdmissionStatus.BUILT, {})
    expect(check.code).toBe('EVIDENCE_MISSING')
    expect(check.missing).toEqual(['sourceGate（闸 0 源码预检报告）'])
  })

  it('晋 tested 时缺静态闸与复现构建引用 → 两项都列出来', () => {
    const check = checkPromotion(AdmissionStatus.BUILT, AdmissionStatus.TESTED, {
      sourceGate: SOURCE_GATE,
    })
    expect(check.missing).toEqual([
      'staticGate（闸 1 静态白名单报告）',
      'reproducibleBuildRef（闸 2 复现构建引用）',
    ])
  })

  it('影子记录没有对照物 / 没有观测次数 → 逐条列出（不是一句"证据不足"）', () => {
    const check = checkPromotion(AdmissionStatus.TESTED, AdmissionStatus.SHADOW, {
      shadow: { parallelWith: '', startedAt: '', observedInvocations: 0, differingResults: 0 },
    })
    expect(check.missing).toEqual([
      'shadow.parallelWith（影子必须有对照物）',
      'shadow.startedAt',
      'shadow.observedInvocations（没有观测记录的影子期不算影子期）',
    ])
  })

  it('影子期有未审查的差异 → 不许晋灰度，并给出差异条数', () => {
    const check = checkPromotion(AdmissionStatus.SHADOW, AdmissionStatus.CANARY, {
      shadow: { ...CLEAN_SHADOW, differingResults: 12, reviewedDiffs: 10 },
    })
    expect(check.code).toBe('EVIDENCE_MISSING')
    expect(check.missing?.[0]).toContain('差异 12 条，已审查 10 条')
  })

  it('差异全部审查过 → 可以晋灰度（差异本身不是拒绝理由，没查才是）', () => {
    const check = checkPromotion(AdmissionStatus.SHADOW, AdmissionStatus.CANARY, {
      shadow: { ...CLEAN_SHADOW, differingResults: 12, reviewedDiffs: 12 },
      canary: CLEAN_CANARY,
    })
    expect(check.allowed).toBe(true)
  })

  it('灰度期有未审查差异 → 不许晋全量', () => {
    const check = checkPromotion(AdmissionStatus.CANARY, AdmissionStatus.ACTIVE, {
      canary: { ...CLEAN_CANARY, differingResults: 3 },
    })
    expect(check.missing?.[0]).toContain('canary 差异未审查')
  })
})

describe('安全动作不被闸拦', () => {
  it.each([
    AdmissionStatus.SUBMITTED,
    AdmissionStatus.TESTED,
    AdmissionStatus.SHADOW,
    AdmissionStatus.ACTIVE,
    AdmissionStatus.REJECTED,
    AdmissionStatus.REVOKED,
  ])('%s → revoked 永远允许（哪怕没有任何证据）', (from) => {
    const check = checkPromotion(from, AdmissionStatus.REVOKED, {})
    expect(check.allowed).toBe(true)
    expect(check.detail).toContain('吊销')
  })

  it('标记为不合格（rejected）同样不受证据门限制', () => {
    expect(checkPromotion(AdmissionStatus.SHADOW, AdmissionStatus.REJECTED, {}).allowed).toBe(true)
  })
})

describe('终态不可复活', () => {
  it.each([[AdmissionStatus.REJECTED], [AdmissionStatus.REVOKED]])(
    '%s → built 被拒（要重来得走新记录）',
    (from) => {
      const check = checkPromotion(from, AdmissionStatus.BUILT, FULL_EVIDENCE)
      expect(check.code).toBe('TERMINAL_STATUS')
      expect(check.detail).toContain('新记录')
    },
  )
})

describe('一次性补录（闸 4 上线前的存量）', () => {
  const grandfathered: ReleaseEvidence = {
    grandfather: {
      reason: '早于闸 4 上线',
      decidedBy: 'migration-1790800000000',
      at: '2026-09-25T00:00:00Z',
    },
  }

  it('补录后即使跨级也放行 —— 但 detail 里带着理由与决定人', () => {
    const check = checkPromotion(AdmissionStatus.TESTED, AdmissionStatus.ACTIVE, grandfathered)
    expect(check.allowed).toBe(true)
    expect(check.detail).toContain('migration-1790800000000')
    expect(check.detail).toContain('早于闸 4 上线')
  })

  it('补录不覆盖终态规则：终态仍然不能复活', () => {
    expect(checkPromotion(AdmissionStatus.REVOKED, AdmissionStatus.ACTIVE, grandfathered).code).toBe(
      'TERMINAL_STATUS',
    )
  })
})

describe('证据形状校验', () => {
  it('合法证据没有问题', () => {
    expect(validateReleaseEvidence(FULL_EVIDENCE)).toEqual([])
  })

  it('负数观测次数 / 空对照物 / 空理由都被挑出来', () => {
    const errors = validateReleaseEvidence({
      shadow: { parallelWith: '', startedAt: '', observedInvocations: -1, differingResults: 1.5 },
      grandfather: { reason: '', decidedBy: '', at: '' },
    })
    expect(errors).toEqual([
      'shadow.parallelWith 不能为空（影子必须有对照物）',
      'shadow.startedAt 不能为空',
      'shadow.observedInvocations 必须是非负整数',
      'shadow.differingResults 必须是非负整数',
      'grandfather.reason 不能为空（补录必须写明理由）',
      'grandfather.decidedBy 不能为空',
    ])
  })
})

describe('requiresReleaseEvidence', () => {
  it.each([
    [AdmissionStatus.SHADOW, true],
    [AdmissionStatus.CANARY, true],
    [AdmissionStatus.ACTIVE, true],
    [AdmissionStatus.TESTED, false],
    [AdmissionStatus.SUBMITTED, false],
  ])('%s → %s', (status, expected) => {
    expect(requiresReleaseEvidence(status)).toBe(expected)
  })
})
