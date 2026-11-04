/**
 * 分录生成与运行时借贷平衡：纯函数，不落库。
 * 金额用 money.ts 定点；平衡失败给出两侧合计。
 */

import {
  addAligned,
  compare,
  DEFAULT_MONEY_SCALE,
  type FixedDecimal,
  formatFixed,
  parseFixed,
} from '../blueprint/money'
import { parseDecimalInput } from '../blueprint/expression-evaluator'

export interface AccountingEntryDecl {
  account: string
  side: 'debit' | 'credit'
  amount: number | string
}

export interface AccountingRuleDecl {
  id: string
  on: string
  entries: AccountingEntryDecl[]
}

export interface JournalDraft {
  ruleId: string
  event: string
  account: string
  side: 'debit' | 'credit'
  amount: FixedDecimal
}

export type AmountRef =
  | { kind: 'literal'; text: string }
  | { kind: 'field'; field: string }

export class AccountingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AccountingError'
  }
}

export function parseAmountRef(amount: number | string): AmountRef {
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) throw new AccountingError(`金额字面量不是有限数字：${amount}`)
    return { kind: 'literal', text: String(amount) }
  }
  if (/^-?\d+(\.\d+)?$/.test(amount)) return { kind: 'literal', text: amount }
  const match = amount.match(/^\$entity\.([A-Za-z_][A-Za-z0-9_]*)$/)
  if (match) return { kind: 'field', field: match[1] }
  throw new AccountingError(`金额既不是字面量也不是 $entity.field：${amount}`)
}

export function resolveAmount(
  amount: number | string,
  values: Record<string, unknown>,
  scale: number = DEFAULT_MONEY_SCALE,
): FixedDecimal {
  const ref = parseAmountRef(amount)
  if (ref.kind === 'literal') {
    return parseFixed(ref.text, scale)
  }
  if (!(ref.field in values)) {
    throw new AccountingError(`记账引用了不存在的字段 ${ref.field}`)
  }
  try {
    return parseDecimalInput(values[ref.field], scale, `$entity.${ref.field}`)
  } catch (error) {
    throw new AccountingError((error as Error).message)
  }
}

export function generateEntries(
  rule: AccountingRuleDecl,
  values: Record<string, unknown>,
  scale: number = DEFAULT_MONEY_SCALE,
): JournalDraft[] {
  return rule.entries.map((entry) => ({
    ruleId: rule.id,
    event: rule.on,
    account: entry.account,
    side: entry.side,
    amount: resolveAmount(entry.amount, values, scale),
  }))
}

export function assertBalanced(ruleId: string, entries: JournalDraft[]): void {
  const debits = entries.filter((entry) => entry.side === 'debit')
  const credits = entries.filter((entry) => entry.side === 'credit')
  const debitSum = debits.reduce(
    (sum, entry) => addAligned(sum, entry.amount),
    parseFixed('0', 0),
  )
  const creditSum = credits.reduce(
    (sum, entry) => addAligned(sum, entry.amount),
    parseFixed('0', 0),
  )
  if (compare(debitSum, creditSum) !== 0) {
    throw new AccountingError(
      `记账不平衡：规则 ${ruleId} 借方 [${formatSide(debits)} = ${formatFixed(debitSum)}] ` +
        `贷方 [${formatSide(credits)} = ${formatFixed(creditSum)}]`,
    )
  }
}

function formatSide(entries: JournalDraft[]): string {
  return entries.map((entry) => formatFixed(entry.amount)).join(', ')
}
