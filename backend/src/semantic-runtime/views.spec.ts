import {
  asDecimalText,
  assembleInTransitView,
  assembleReceivableView,
  assembleStockView,
} from './views'

describe('平台内置视图组装', () => {
  it('库存：按零件聚合字段原样落到结果；按 partNo 再按 partId 排序', () => {
    const rows = assembleStockView([
      { partId: 'p-b', partNo: 'BRK-02', onHand: 4, reserved: 1, available: 3, inTransit: 2 },
      { partId: 'p-a', partNo: 'BRK-01', onHand: '10', reserved: '3', available: '7', inTransit: '0' },
    ])
    expect(rows.map((row) => row.partNo)).toEqual(['BRK-01', 'BRK-02'])
    expect(rows[0]).toEqual({
      partId: 'p-a',
      partNo: 'BRK-01',
      onHand: 10,
      reserved: 3,
      available: 7,
      inTransit: 0,
    })
  })

  it('在途：缺 partNo 仍返回 partId；确定性排序落到 id', () => {
    const rows = assembleInTransitView([
      { partId: 'p-2', partNo: null, inTransit: 5 },
      { partId: 'p-1', partNo: null, inTransit: '2' },
    ])
    expect(rows.map((row) => row.partId)).toEqual(['p-1', 'p-2'])
    expect(rows[0]).toEqual({ partId: 'p-1', inTransit: 2 })
    expect(rows[0].partNo).toBeUndefined()
  })

  it('应收：金额保持小数串，不进 JS number', () => {
    const rows = assembleReceivableView([
      { customerId: 'c-2', customerName: 'Store-B', receivable: '80.0000' },
      { customerId: 'c-1', customerName: 'Store-A', receivable: '120.5000' },
    ])
    expect(rows.map((row) => row.customerName)).toEqual(['Store-A', 'Store-B'])
    expect(rows[0].receivable).toBe('120.5000')
    expect(typeof rows[0].receivable).toBe('string')
  })

  it('空输入 → 空数组（对应 HTTP 200 + []）', () => {
    expect(assembleStockView([])).toEqual([])
    expect(assembleInTransitView([])).toEqual([])
    expect(assembleReceivableView([])).toEqual([])
  })

  it('应收按 (customerId, currency) 分组，绝不把两种货币合成一个数', () => {
    const rows = assembleReceivableView([
      { customerId: 'c-1', customerName: 'Store-A', receivable: '40.0000', currency: 'CNY' },
      { customerId: 'c-1', customerName: 'Store-A', receivable: '20.0000', currency: 'USD' },
    ])
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.currency)).toEqual(['CNY', 'USD'])
    expect(rows.find((row) => row.currency === 'CNY')?.receivable).toBe('40.0000')
    expect(rows.find((row) => row.currency === 'USD')?.receivable).toBe('20.0000')
  })

  it('负例：非法金额串不落到 number，回退为 "0"', () => {
    expect(asDecimalText(1.25)).toBe('0')
    expect(asDecimalText(Number.NaN)).toBe('0')
    expect(asDecimalText('1e2')).toBe('0')
    expect(asDecimalText(null)).toBe('0')
    expect(asDecimalText(12)).toBe('12')
    expect(assembleReceivableView([{ customerId: 'c-1', customerName: 'Store-A', receivable: 1.25 }])).toEqual([
      { customerId: 'c-1', customerName: 'Store-A', receivable: '0' },
    ])
  })
})
