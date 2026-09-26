import { computeRollupValue, materializeComputed } from './eval-context'
import type { SemanticEntity } from './record-validator'

const LINE: SemanticEntity = {
  name: 'SalesOrderLine',
  fields: [
    { name: 'quantity', type: 'number' },
    { name: 'unitPrice', type: 'decimal', scale: 4, rounding: 'half-up' },
    {
      name: 'amount',
      type: 'decimal',
      scale: 4,
      rounding: 'half-up',
      computed: { expr: 'quantity * unitPrice', dependsOn: ['quantity', 'unitPrice'] },
    },
  ],
}

const HEAD: SemanticEntity = {
  name: 'SalesOrder',
  fields: [{ name: 'totalAmount', type: 'decimal', scale: 4, rounding: 'half-up' }],
  rollups: [{ field: 'totalAmount', over: 'SalesOrderLine', of: 'amount', fn: 'sum' }],
}

describe('判定点上下文（computed + rollup）', () => {
  it('行金额中间全精度，合计写盘按字段标度舍一次', () => {
    const line = materializeComputed(LINE, { quantity: 3, unitPrice: '20.0000' })
    expect(line.amount).toBe('60.0000')
    const total = computeRollupValue(HEAD, HEAD.rollups![0], LINE, [
      { quantity: 3, unitPrice: '20.0000' },
      { quantity: 2, unitPrice: '20.0000' },
    ])
    expect(total).toBe('100.0000')
  })

  it('负例：rollup 字段未声明 → 拒', () => {
    expect(() =>
      computeRollupValue(
        { name: 'SalesOrder', fields: [] },
        { field: 'totalAmount', over: 'SalesOrderLine', of: 'amount', fn: 'sum' },
        LINE,
        [],
      ),
    ).toThrow(/未声明/)
  })
})
