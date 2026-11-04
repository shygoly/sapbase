/**
 * 闸 3：原子输出管控。
 *
 * 这里是判据的**唯一实现**，判据文本在 `docs/protocols/atomic-output-audit.md`。
 * 执行器只负责"按档位多跑几次 + 把结果交给本模块"，不再自己判任何一条 ——
 * 值域与大小上限原先散在 `AtomicExecutor.invoke` 里，已收进这里（元语不变量 12：
 * 一份判定逻辑只写一次）。
 *
 * 全部判据都是**确定性**的：同样的输入与声明必然得到同样的结论。
 * 不做统计检验、不做抽样、不模糊测试 —— 样本量撑不起结论，只会得到随机的红绿。
 */

export type OutputAuditProfile = 'off' | 'standard' | 'strict'

/** 判据编号，与协议文本一一对应。 */
export type OutputGateCriterion = 'O1' | 'O2' | 'O3' | 'O4' | 'O5'

export const OUTPUT_GATE_CRITERIA: OutputGateCriterion[] = ['O1', 'O2', 'O3', 'O4', 'O5']

/**
 * 重放上限：O4 / O5 需要对同一组输入再跑一遍（逐行或置换），成本随行数线性增长。
 * 超过上限时**只判前 N 行**并在报告里写明 —— 这不是抽样（抽样得到的是随机结论），
 * 而是确定性地少判一段，并把"少判了"写在脸上。
 */
export const GATE_MAX_REPLAY_ROWS = 64

export interface OutputGateDeclaration {
  profile: OutputAuditProfile
  columns: Array<{ name: string; minimum?: number; maximum?: number }>
  totalName?: string
  maxOutputBytes: number
  /** 契约是否声明该原子对输入行序可交换（决定 O5 判不判）。 */
  commutative: boolean
}

/** 一次执行的原始输出（列优先，与宿主投影一致）。 */
export interface GateRun {
  /** `[col0 的 rows 个值][col1 的 rows 个值]…[total]` */
  values: Int32Array
  rows: number
}

export interface OutputGateVerdict {
  judged: boolean
  passed: boolean
  /** 判了但没过时的具体原因（含列名与期望/实际值）。 */
  detail?: string
  /** 没判时的原因 —— **不允许出现"没判但看起来像通过"的空白**。 */
  reason?: string
  /** 实际参与判定的行数（被重放上限截断时小于总行数）。 */
  rowsJudged?: number
}

export interface OutputGateSignal {
  code: 'constant-column'
  column: string
  note: string
}

export interface OutputGateReport {
  profile: OutputAuditProfile
  verdicts: Record<OutputGateCriterion, OutputGateVerdict>
  signals: OutputGateSignal[]
  /** 本次判定实际执行的内核回合数（含批量那一次）。 */
  rounds: number
}

export interface OutputGateInput {
  declaration: OutputGateDeclaration
  /** 调用方真正要的那次结果。 */
  batch: GateRun
  /** 逐行各算一次再拼的结果（O4）；未跑即记未判。 */
  perRow?: GateRun
  /** 置换后的结果与所用置换（O5）：`permuted` 的第 j 行来自原始第 permutation[j] 行。 */
  permuted?: { run: GateRun; permutation: number[] }
  /** 已执行的内核回合数（审计用）。 */
  rounds: number
}

/** 按列序号取值（列优先布局）。 */
function columnOf(run: GateRun, index: number, rows: number): number[] {
  const out: number[] = []
  for (let i = 0; i < rows; i += 1) out.push(run.values[index * rows + i])
  return out
}

function ok(rowsJudged?: number): OutputGateVerdict {
  return rowsJudged === undefined
    ? { judged: true, passed: true }
    : { judged: true, passed: true, rowsJudged }
}

function fail(detail: string, rowsJudged?: number): OutputGateVerdict {
  return rowsJudged === undefined
    ? { judged: true, passed: false, detail }
    : { judged: true, passed: false, detail, rowsJudged }
}

function notJudged(reason: string): OutputGateVerdict {
  return { judged: false, passed: false, reason }
}

/** O1 结构封闭：输出只由声明的列与汇总位构成。 */
export function judgeStructure(
  batch: GateRun,
  columnCount: number,
  hasTotal: boolean,
): OutputGateVerdict {
  const expected = columnCount * batch.rows + (hasTotal ? 1 : 0)
  if (batch.values.length !== expected) {
    return fail(
      `输出长度为 ${batch.values.length}，按声明（${columnCount} 列 × ${batch.rows} 行` +
        `${hasTotal ? ' + 1 个汇总位' : ''}）应为 ${expected}`,
    )
  }
  return ok()
}

/** O2 值域：每个值落在声明的 minimum / maximum 内。 */
export function judgeRanges(
  declaration: OutputGateDeclaration,
  batch: GateRun,
): OutputGateVerdict {
  for (const [index, column] of declaration.columns.entries()) {
    if (column.minimum === undefined && column.maximum === undefined) continue
    for (const value of columnOf(batch, index, batch.rows)) {
      if (
        (column.minimum !== undefined && value < column.minimum) ||
        (column.maximum !== undefined && value > column.maximum)
      ) {
        return fail(
          `${column.name}=${value} 超出契约值域 [${column.minimum ?? '-∞'}, ${column.maximum ?? '+∞'}]`,
        )
      }
    }
  }
  return ok()
}

/** O3 大小上限：输出字节数不超过契约声明。 */
export function judgeSize(
  declaration: OutputGateDeclaration,
  batch: GateRun,
): OutputGateVerdict {
  const bytes = batch.values.length * 4
  if (bytes > declaration.maxOutputBytes) {
    return fail(`输出 ${bytes} 字节，超过契约上限 ${declaration.maxOutputBytes}`)
  }
  return ok()
}

/** O4 批量-单条一致（**无需任何声明**；输入不足 2 行时无从判别）。 */
export function judgeBatchConsistency(
  declaration: OutputGateDeclaration,
  batch: GateRun,
  perRow: GateRun | undefined,
): OutputGateVerdict {
  if (batch.rows < 2) {
    return notJudged('输入只有 1 行：批量与单条本就等价，无从判别')
  }
  if (!perRow) {
    return notJudged('档位 off：未执行逐行重放')
  }

  const judged = perRow.rows
  for (const [index, column] of declaration.columns.entries()) {
    const batchValues = columnOf(batch, index, batch.rows)
    const perRowValues = columnOf(perRow, index, judged)
    for (let i = 0; i < judged; i += 1) {
      if (batchValues[i] !== perRowValues[i]) {
        return fail(
          `${column.name} 第 ${i} 行：批量算 ${batchValues[i]}，单独算 ${perRowValues[i]}`,
          judged,
        )
      }
    }
  }

  if (declaration.totalName) {
    const batchTotal = batch.values[declaration.columns.length * batch.rows]
    const perRowTotal = perRow.values[declaration.columns.length * judged]
    if (batchTotal !== perRowTotal) {
      return fail(
        `汇总位：批量算 ${batchTotal}，单独算 ${perRowTotal}`,
        judged,
      )
    }
  }
  return ok(judged)
}

/** O5 置换不变：仅当契约声明可交换时才判（判不了就写明"未判"）。 */
export function judgePermutation(
  declaration: OutputGateDeclaration,
  batch: GateRun,
  permuted: { run: GateRun; permutation: number[] } | undefined,
): OutputGateVerdict {
  if (!declaration.commutative) {
    return notJudged('契约未声明 commutative')
  }
  if (batch.rows < 2) {
    return notJudged('输入只有 1 行：置换没有可观察的效果')
  }
  if (!permuted) {
    return notJudged('档位 off：未执行置换重放')
  }

  const { run, permutation } = permuted
  const judged = run.rows
  for (const [index, column] of declaration.columns.entries()) {
    const batchValues = columnOf(batch, index, batch.rows)
    const permutedValues = columnOf(run, index, judged)
    for (let j = 0; j < judged; j += 1) {
      if (permutedValues[j] !== batchValues[permutation[j]]) {
        return fail(
          `${column.name}：打乱行序后第 ${j} 行得到 ${permutedValues[j]}，` +
            `期望原第 ${permutation[j]} 行的 ${batchValues[permutation[j]]}`,
          judged,
        )
      }
    }
  }

  if (declaration.totalName) {
    const batchTotal = batch.values[declaration.columns.length * batch.rows]
    const permutedTotal = run.values[declaration.columns.length * judged]
    if (batchTotal !== permutedTotal) {
      return fail(
        `汇总位：原序 ${batchTotal}，打乱行序后 ${permutedTotal}（声明可交换即承诺它不变）`,
        judged,
      )
    }
  }
  return ok(judged)
}

/**
 * S1 常量位模式 —— **信号，不是判决**。
 *
 * v1 只有一条：`constant-column`（整列同值）。
 *
 * 为什么只发信号：合法原子真的可能输出常量（空输入的零汇总、固定档位的取整）。
 * 把它做成判决，会让人把整个闸关掉 —— 那比没有闸更糟。
 *
 * 为什么**没有**"恒定高位"这条（初稿写过，被自己否掉）：
 * 任何两个小整数的高位都相同，于是这条信号几乎次次触发 —— 一条每回都亮的信号
 * 等于没有信号，还会训练人忽略审计。真正能判"高位被塞了东西"的是 O2：
 * **前提是契约声明了值域**，那是作者对"值应该长什么样"的显式承诺，不是平台的猜测。
 */
export function detectSignals(
  declaration: OutputGateDeclaration,
  batch: GateRun,
): OutputGateSignal[] {
  const signals: OutputGateSignal[] = []
  for (const [index, column] of declaration.columns.entries()) {
    const values = columnOf(batch, index, batch.rows)
    if (values.length === 0) continue
    if (values.every((value) => value === values[0])) {
      signals.push({
        code: 'constant-column',
        column: column.name,
        note: `整列同值（${values[0]}），与输入的关系值得看一眼`,
      })
    }
  }
  return signals
}

/** 闸 3 判定：四条判决（O1–O4）+ 一条条件判决（O5）+ 一条信号（S1）。 */
export function judgeOutput(input: OutputGateInput): OutputGateReport {
  const { declaration, batch, perRow, permuted, rounds } = input
  return {
    profile: declaration.profile,
    verdicts: {
      O1: judgeStructure(batch, declaration.columns.length, Boolean(declaration.totalName)),
      O2: judgeRanges(declaration, batch),
      O3: judgeSize(declaration, batch),
      O4: judgeBatchConsistency(declaration, batch, perRow),
      O5: judgePermutation(declaration, batch, permuted),
    },
    signals: detectSignals(declaration, batch),
    rounds,
  }
}

/** 第一条未通过的判决（按 O1→O5 顺序），没有则返回 null。 */
export function firstFailedVerdict(
  report: OutputGateReport,
): { criterion: OutputGateCriterion; detail: string } | null {
  for (const criterion of OUTPUT_GATE_CRITERIA) {
    const verdict = report.verdicts[criterion]
    if (verdict.judged && !verdict.passed) {
      return { criterion, detail: verdict.detail ?? '未给出原因' }
    }
  }
  return null
}

/**
 * 契约 → 闸 3 声明。
 *
 * 档位缺省为 `standard`；`commutative` 缺省为 false（**未声明即不判 O5**，
 * 而不是默认通过）。
 */
export function gateDeclarationOf(contract: {
  outputAudit?: string
  outputSchema: unknown
}): OutputGateDeclaration {
  const outputSchema = (contract.outputSchema ?? {}) as {
    columns?: Array<{ name: string; minimum?: number; maximum?: number }>
    total?: { name: string }
    maxOutputBytes?: number
    commutative?: boolean
  }
  const profile = (contract.outputAudit ?? 'standard') as OutputAuditProfile
  return {
    profile,
    columns: (outputSchema.columns ?? []).map((column) => ({
      name: column.name,
      minimum: column.minimum,
      maximum: column.maximum,
    })),
    totalName: outputSchema.total?.name,
    maxOutputBytes: outputSchema.maxOutputBytes ?? 1024 * 1024,
    commutative: outputSchema.commutative === true,
  }
}
