import { formatFixed } from '../blueprint/money'
import {
  AccountingError,
  assertBalanced,
  generateEntries,
  parseAmountRef,
  resolveAmount,
} from './accounting'

const RULE = {
  id: 'so-shipped',
  on: 'SalesOrder.shipped',
  entries: [
    { account: '1122', side: 'debit' as const, amount: '$entity.totalAmount' },
    { account: '6001', side: 'credit' as const, amount: '$entity.totalAmount' },
  ],
}

describe('记账分录纯逻辑', () => {
  it('解析 $entity.field 与字面量', () => {
    expect(parseAmountRef('$entity.totalAmount')).toEqual({ kind: 'field', field: 'totalAmount' })
    expect(parseAmountRef('20.0000')).toEqual({ kind: 'literal', text: '20.0000' })
    expect(parseAmountRef(20)).toEqual({ kind: 'literal', text: '20' })
  })

  it('引用字段取额；借贷平衡通过', () => {
    const entries = generateEntries(RULE, { totalAmount: '120000.0000' }, 4)
    expect(entries).toHaveLength(2)
    expect(formatFixed(entries[0].amount)).toBe('120000.0000')
    expect(() => assertBalanced(RULE.id, entries)).not.toThrow()
  })

  it('负例：引用不存在的字段 → 拒', () => {
    expect(() => resolveAmount('$entity.ghost', { totalAmount: '1' }, 4)).toThrow(AccountingError)
    expect(() => resolveAmount('$entity.ghost', { totalAmount: '1' }, 4)).toThrow(/ghost/)
  })

  it('负例：运行时借贷不平衡给出两侧合计', () => {
    const unbalanced = [
      { ...RULE.entries[0], amount: '100' },
      { ...RULE.entries[1], amount: '80' },
    ]
    const entries = generateEntries({ ...RULE, entries: unbalanced }, {}, 4)
    expect(() => assertBalanced(RULE.id, entries)).toThrow(/借方 \[100.0000 = 100.0000\]/)
    expect(() => assertBalanced(RULE.id, entries)).toThrow(/贷方 \[80.0000 = 80.0000\]/)
  })
})
