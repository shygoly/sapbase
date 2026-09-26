import { formatFixed, parseFixed, roundTo } from './money'
import {
  asDecimal,
  evaluateComputed,
  evaluateCondition,
  parseComputedSyntax,
  parseConditionSyntax,
} from './expression-evaluator'
import { parseRestrictedExpression } from './rules-expression'

describe('条件语法：算术在操作数层，顶层必须是布尔', () => {
  it('正例：quantity * unitPrice > 100000 合法', () => {
    const parsed = parseConditionSyntax('quantity * unitPrice > 100000')
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.identifiers).toEqual(['quantity', 'unitPrice'])
    }
  })

  it('负例：amount + 1 不是条件（既有闸不放松）', () => {
    expect(parseRestrictedExpression('amount + 1').ok).toBe(false)
    expect(parseConditionSyntax('amount + 1').ok).toBe(false)
  })

  it('负例：裸乘法 / 未闭合 / 非法运算符', () => {
    expect(parseConditionSyntax('quantity * unitPrice').ok).toBe(false)
    expect(parseConditionSyntax('(quantity * unitPrice > 1').ok).toBe(false)
    expect(parseConditionSyntax('amount >> 1').ok).toBe(false)
  })
})

describe('evaluateCondition / evaluateComputed', () => {
  it('金额合计条件：quantity * unitPrice > 100000 按定点比较', () => {
    const hit = evaluateCondition('quantity * unitPrice > 100000', {
      values: { quantity: 6000, unitPrice: '20.0000' },
      types: { quantity: { type: 'number' }, unitPrice: { type: 'decimal', scale: 4 } },
    })
    expect(hit).toEqual({ ok: true, value: true })

    const miss = evaluateCondition('quantity * unitPrice > 100000', {
      values: { quantity: 2, unitPrice: '20.0000' },
      types: { quantity: { type: 'number' }, unitPrice: { type: 'decimal', scale: 4 } },
    })
    expect(miss).toEqual({ ok: true, value: false })
  })

  it('负例：引用不存在的字段 → 拒', () => {
    const result = evaluateCondition('ghost > 1', { values: { quantity: 1 } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/ghost/)
  })

  it('负例：decimal 与非整数 number 混算 → 拒', () => {
    const result = evaluateComputed('unitPrice * rate', {
      values: { unitPrice: '20.0000', rate: 0.1 },
      types: { unitPrice: { type: 'decimal', scale: 4 }, rate: { type: 'number' } },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/非整数 number/)
  })

  it('中间不舍入、写盘舍一次：(0.1+0.2)*10', () => {
    const computed = evaluateComputed('(a + b) * c', {
      values: { a: '0.1', b: '0.2', c: 10 },
      types: {
        a: { type: 'decimal', scale: 1 },
        b: { type: 'decimal', scale: 1 },
        c: { type: 'number' },
      },
    })
    expect(computed.ok).toBe(true)
    if (!computed.ok) return
    const raw = asDecimal(computed.value)
    expect(formatFixed(raw)).toBe('3.0')
    expect(raw.scale).toBe(1)
    const written = roundTo(raw, 4, 'half-up')
    expect(formatFixed(written)).toBe('3.0000')
    expect(written.scale).toBe(4)
  })

  it('计算字段 quantity * unitPrice 得到全精度乘积', () => {
    const computed = evaluateComputed('quantity * unitPrice', {
      values: { quantity: 3, unitPrice: '20.0000' },
      types: { quantity: { type: 'number' }, unitPrice: { type: 'decimal', scale: 4 } },
    })
    expect(computed.ok).toBe(true)
    if (!computed.ok) return
    expect(formatFixed(asDecimal(computed.value))).toBe('60.0000')
    expect(asDecimal(computed.value).scale).toBe(4)
  })

  it('比较对齐标度后比 bigint，不做舍入', () => {
    const result = evaluateCondition('left == right', {
      values: { left: '1.0', right: '1.0000' },
      types: { left: { type: 'decimal', scale: 1 }, right: { type: 'decimal', scale: 4 } },
    })
    expect(result).toEqual({ ok: true, value: true })
    expect(compareExact()).toBe(0)
  })
})

function compareExact(): number {
  return formatFixed(parseFixed('1.0', 1)) === '1.0' ? 0 : 1
}

describe('防御性 currency-mismatch（模板侧已被编译期拦住）', () => {
  it('负例：两个不同货币的金额相加 → currency-mismatch', () => {
    const result = evaluateComputed('cny + usd', {
      values: { cny: '10.0000', usd: '2.0000' },
      types: {
        cny: { type: 'decimal', scale: 4, currency: 'CNY' },
        usd: { type: 'decimal', scale: 4, currency: 'USD' },
      },
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/currency-mismatch/)
  })

  it('正例：同币种相加通过；金额乘数量不判币种', () => {
    const same = evaluateComputed('a + b', {
      values: { a: '10.0000', b: '2.0000' },
      types: {
        a: { type: 'decimal', scale: 4, currency: 'CNY' },
        b: { type: 'decimal', scale: 4, currency: 'CNY' },
      },
    })
    expect(same.ok).toBe(true)

    const mul = evaluateComputed('quantity * unitPrice', {
      values: { quantity: 3, unitPrice: '20.0000' },
      types: {
        quantity: { type: 'number' },
        unitPrice: { type: 'decimal', scale: 4, currency: 'CNY' },
      },
    })
    expect(mul.ok).toBe(true)
  })
})

describe('parseComputedSyntax 与既有入口一致', () => {
  it('正例抽标识符；比较运算符仍拒', () => {
    expect(parseComputedSyntax('quantity * unitPrice')).toEqual({
      ok: true,
      identifiers: ['quantity', 'unitPrice'],
    })
    expect(parseComputedSyntax('quantity > 1').ok).toBe(false)
  })
})
