// 闸 3 判据：四条判决（O1–O4）+ 条件判决（O5）+ 信号（S1）。
// 每条判据都要有正例、负例与"未判"三种情形 —— 三者混淆是这类闸最常见的失效方式。
import {
  detectSignals,
  firstFailedVerdict,
  gateDeclarationOf,
  judgeBatchConsistency,
  judgeOutput,
  judgePermutation,
  judgeRanges,
  judgeSize,
  judgeStructure,
  type GateRun,
  type OutputGateDeclaration,
  type OutputGateReport,
} from './output-gate'

const DECLARATION: OutputGateDeclaration = {
  profile: 'standard',
  columns: [{ name: 'available', minimum: 0, maximum: 1000000 }],
  totalName: 'totalAvailable',
  maxOutputBytes: 65536,
  commutative: false,
}

/** 一列 + 汇总位的结果。 */
function run(available: number[], total?: number): GateRun {
  const values = Int32Array.from(total === undefined ? available : [...available, total])
  return { values, rows: available.length }
}

function report(overrides: Partial<Parameters<typeof judgeOutput>[0]>): OutputGateReport {
  return judgeOutput({
    declaration: DECLARATION,
    batch: run([7, 8], 15),
    rounds: 3,
    ...overrides,
  })
}

describe('O1 结构封闭', () => {
  it('长度与声明一致 → 通过', () => {
    expect(judgeStructure(run([7, 8], 15), 1, true)).toEqual({ judged: true, passed: true })
  })

  it('缺了汇总位 → 判失败并说明应有的长度', () => {
    const verdict = judgeStructure(run([7, 8]), 1, true)
    expect(verdict.passed).toBe(false)
    expect(verdict.detail).toContain('应为 3')
  })

  it('列数与行数对不上（多了值）→ 判失败', () => {
    expect(judgeStructure({ values: Int32Array.from([7, 8, 15, 99]), rows: 2 }, 1, true).passed).toBe(
      false,
    )
  })
})

describe('O2 值域', () => {
  it('值在声明范围内 → 通过', () => {
    expect(judgeRanges(DECLARATION, run([0, 1000000], 1000000))).toEqual({
      judged: true,
      passed: true,
    })
  })

  it('超过 maximum → 判失败，明细含列名、实际值与上界', () => {
    const verdict = judgeRanges(DECLARATION, run([7, 0x5ec00007], 1589641230))
    expect(verdict.passed).toBe(false)
    expect(verdict.detail).toContain(`available=${0x5ec00007}`)
    expect(verdict.detail).toContain('1000000')
  })

  it('低于 minimum → 判失败', () => {
    expect(judgeRanges(DECLARATION, run([-1], -1)).passed).toBe(false)
  })

  it('未声明值域的列不判（没有声明就没有判据）', () => {
    const noBounds: OutputGateDeclaration = {
      ...DECLARATION,
      columns: [{ name: 'available' }],
    }
    expect(judgeRanges(noBounds, run([-2147483648, 2147483647], 0))).toEqual({
      judged: true,
      passed: true,
    })
  })
})

describe('O3 大小上限', () => {
  it('在上限内 → 通过', () => {
    expect(judgeSize(DECLARATION, run([7, 8], 15))).toEqual({ judged: true, passed: true })
  })

  it('超上限 → 判失败并给出字节数', () => {
    const verdict = judgeSize({ ...DECLARATION, maxOutputBytes: 4 }, run([7, 8], 15))
    expect(verdict.passed).toBe(false)
    expect(verdict.detail).toContain('12 字节')
  })
})

describe('O4 批量-单条一致', () => {
  it('输入只有 1 行 → 未判，并写明原因（不是通过）', () => {
    const verdict = judgeBatchConsistency(DECLARATION, run([7], 7), undefined)
    expect(verdict.judged).toBe(false)
    expect(verdict.passed).toBe(false)
    expect(verdict.reason).toContain('只有 1 行')
  })

  it('档位 off（没跑逐行重放）→ 未判，并写明原因', () => {
    const verdict = judgeBatchConsistency(DECLARATION, run([7, 8], 15), undefined)
    expect(verdict.judged).toBe(false)
    expect(verdict.reason).toContain('档位 off')
  })

  it('批量与逐行一致 → 通过，并记录实际判了几行', () => {
    const verdict = judgeBatchConsistency(DECLARATION, run([7, 8], 15), run([7, 8], 15))
    expect(verdict).toEqual({ judged: true, passed: true, rowsJudged: 2 })
  })

  it('同一行批量算与单独算不同 → 判失败（行序隐蔽通道）', () => {
    const verdict = judgeBatchConsistency(DECLARATION, run([7, 65636], 101), run([7, 100], 107))
    expect(verdict.passed).toBe(false)
    expect(verdict.detail).toContain('批量算 65636')
    expect(verdict.detail).toContain('单独算 100')
  })

  it('列都对但汇总位不同 → 仍判失败', () => {
    const verdict = judgeBatchConsistency(DECLARATION, run([7, 8], 15), run([7, 8], 16))
    expect(verdict.passed).toBe(false)
    expect(verdict.detail).toContain('汇总位')
  })
})

describe('O5 置换不变', () => {
  const commutative: OutputGateDeclaration = { ...DECLARATION, commutative: true }

  it('未声明 commutative → 未判，且原因写明"未声明"（判不了就不判）', () => {
    const verdict = judgePermutation(DECLARATION, run([7, 8], 15), undefined)
    expect(verdict.judged).toBe(false)
    expect(verdict.reason).toBe('契约未声明 commutative')
  })

  it('声明了但没跑置换（off 档）→ 未判', () => {
    const verdict = judgePermutation(commutative, run([7, 8], 15), undefined)
    expect(verdict.reason).toContain('档位 off')
  })

  it('置换后行随之重排、汇总位不变 → 通过', () => {
    const verdict = judgePermutation(commutative, run([7, 8], 15), {
      run: run([8, 7], 15),
      permutation: [1, 0],
    })
    expect(verdict).toEqual({ judged: true, passed: true, rowsJudged: 2 })
  })

  it('置换后汇总位变了 → 判失败（声明可交换就是承诺它不变）', () => {
    const verdict = judgePermutation(commutative, run([7, 8], 15), {
      run: run([8, 7], 15 + 1),
      permutation: [1, 0],
    })
    expect(verdict.passed).toBe(false)
    expect(verdict.detail).toContain('汇总位')
  })

  it('置换后行没跟着重排（按位置区分）→ 判失败', () => {
    // 夹具二的行为：输入倒序后，第 0 行（原本是 100）仍是 100、
    // 第 1 行（原本是 7）变成 7 ^ 0x10000 —— 与"输出应随行重排"的承诺不符
    const verdict = judgePermutation(commutative, run([7, 65636], 101), {
      run: run([100, 65543], 101),
      permutation: [1, 0],
    })
    expect(verdict.passed).toBe(false)
  })
})

describe('S1 常量位信号（只写审计，不拒绝）', () => {
  it('整列同值 → constant-column 信号', () => {
    const signals = detectSignals(DECLARATION, run([5, 5], 10))
    expect(signals).toEqual([
      {
        code: 'constant-column',
        column: 'available',
        note: '整列同值（5），与输入的关系值得看一眼',
      },
    ])
  })

  it('正常变化的值 → 没有信号（不报"恒定高位"：任何两个小整数的高位都相同）', () => {
    expect(detectSignals(DECLARATION, run([1, 2], 3))).toEqual([])
  })

  it('信号不构成判决：整列同值但值域合法时，报告仍然全通过', () => {
    const result = report({ batch: run([5, 5], 10), perRow: run([5, 5], 10) })
    expect(firstFailedVerdict(result)).toBeNull()
    expect(result.signals).toHaveLength(1)
  })
})

describe('报告整体', () => {
  it('档位、逐条判定、回合数都在报告里', () => {
    const result = report({ perRow: run([7, 8], 15) })
    expect(result.profile).toBe('standard')
    expect(result.rounds).toBe(3)
    expect(Object.keys(result.verdicts)).toEqual(['O1', 'O2', 'O3', 'O4', 'O5'])
  })

  it('O5 未判不影响整体通过，但报告里看得见"未判"', () => {
    const result = report({ perRow: run([7, 8], 15) })
    expect(firstFailedVerdict(result)).toBeNull()
    expect(result.verdicts.O5).toEqual({
      judged: false,
      passed: false,
      reason: '契约未声明 commutative',
    })
  })

  it('多条判决同时命中时，返回编号最小的那条（O1→O5 固定顺序）', () => {
    const result = report({
      batch: run([0x5ec00007, 0x5ec00008]), // O1 缺汇总位 + O2 越界
    })
    expect(firstFailedVerdict(result)?.criterion).toBe('O1')
  })
})

describe('gateDeclarationOf（契约 → 声明）', () => {
  it('缺省档位是 standard，缺省不可交换，缺省输出上限 1 MiB', () => {
    const declaration = gateDeclarationOf({
      outputSchema: { columns: [{ name: 'available', type: 'i32' }] },
    })
    expect(declaration).toEqual({
      profile: 'standard',
      columns: [{ name: 'available', minimum: undefined, maximum: undefined }],
      totalName: undefined,
      maxOutputBytes: 1024 * 1024,
      commutative: false,
    })
  })

  it('显式声明被原样采纳', () => {
    const declaration = gateDeclarationOf({
      outputAudit: 'strict',
      outputSchema: {
        columns: [{ name: 'available', type: 'i32', maximum: 100 }],
        total: { name: 'totalAvailable' },
        maxOutputBytes: 4096,
        commutative: true,
      },
    })
    expect(declaration.profile).toBe('strict')
    expect(declaration.commutative).toBe(true)
    expect(declaration.columns[0].maximum).toBe(100)
    expect(declaration.maxOutputBytes).toBe(4096)
  })
})
