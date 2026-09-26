// 受限表达式：只抽取字段引用、不求值；语法不合法必须拒。
import { parseRestrictedExpression } from './rules-expression'

describe('parseRestrictedExpression', () => {
  it('正例：字段、比较、布尔连接、括号、Entity.field', () => {
    const parsed = parseRestrictedExpression(
      '(amount > 500000 && status == "submitted") || PurchaseOrder.total <= 0',
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.identifiers).toEqual(['amount', 'status', 'PurchaseOrder.total'])
    }
  })

  it('负例：非法运算符 / 未闭合括号 / 空表达式', () => {
    expect(parseRestrictedExpression('amount >> 1').ok).toBe(false)
    expect(parseRestrictedExpression('(amount > 1').ok).toBe(false)
    expect(parseRestrictedExpression('').ok).toBe(false)
    expect(parseRestrictedExpression('amount + 1').ok).toBe(false)
  })

  it('不求值：只返回标识符，不计算真假', () => {
    const parsed = parseRestrictedExpression('amount > 500000')
    expect(parsed).toEqual({ ok: true, identifiers: ['amount'] })
    expect(parsed).not.toHaveProperty('value')
  })
})
