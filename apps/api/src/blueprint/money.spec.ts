import {
  add,
  assertFits,
  compare,
  formatFixed,
  mul,
  parseFixed,
  roundTo,
  sub,
} from './money'

describe('定点金额（整数小单位，不引入浮点）', () => {
  it('0.1 + 0.2 === 0.3（标度 2）', () => {
    const sum = add(parseFixed('0.1', 2), parseFixed('0.2', 2))
    expect(formatFixed(sum)).toBe('0.30')
    expect(compare(sum, parseFixed('0.3', 2))).toBe(0)
  })

  it('中间计算不提前舍入：(0.1+0.2)*10 在标度 2 下得 3.00', () => {
    const sum = add(parseFixed('0.1', 2), parseFixed('0.2', 2))
    const product = mul(sum, parseFixed('10', 0))
    expect(formatFixed(sum)).toBe('0.30')
    expect(formatFixed(product)).toBe('3.00')
    expect(compare(product, parseFixed('3.00', 2))).toBe(0)
  })

  it('half-up 与 half-even 在 .5 上结果不同', () => {
    const twoPointFive = parseFixed('2.5', 1)
    expect(formatFixed(roundTo(twoPointFive, 0, 'half-up'))).toBe('3')
    expect(formatFixed(roundTo(twoPointFive, 0, 'half-even'))).toBe('2')
  })

  it('溢出 / 非法标度 / 多余小数位 → 报错而不是静默截断', () => {
    expect(() => parseFixed('1', -1)).toThrow(/非法标度/)
    expect(() => parseFixed('1', 1.5)).toThrow(/非法标度/)
    expect(() => parseFixed('1', 39)).toThrow(/非法标度/)
    expect(() => parseFixed('0.12', 1)).toThrow(/禁止静默截断/)
    expect(() => assertFits(parseFixed('10', 0), 1)).toThrow(/定点溢出/)
    expect(() => add(parseFixed('1.0', 1), parseFixed('1.00', 2))).toThrow(/同一标度/)
  })

  it('sub / compare 保持整数语义', () => {
    const left = parseFixed('0.30', 2)
    const right = parseFixed('0.10', 2)
    expect(formatFixed(sub(left, right))).toBe('0.20')
    expect(compare(left, right)).toBe(1)
    expect(compare(right, left)).toBe(-1)
  })
})
