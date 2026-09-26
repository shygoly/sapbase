import { assembleTraceability } from './traceability'

describe('assembleTraceability（反向查询组装，读路径不抛）', () => {
  it('未知批次 → found:false + hits:[]', () => {
    expect(assembleTraceability('B-NONE', [], { parts: new Map(), orders: new Map(), customers: new Map() })).toEqual({
      found: false,
      batchNo: 'B-NONE',
      hits: [],
    })
  })

  it('召回：批次 → 订单 → 客户，带出发货时间与数量、零件号', () => {
    const result = assembleTraceability(
      'B-2026-001',
      [
        {
          id: 'batch-1',
          data: {
            batchNo: 'B-2026-001',
            part: 'part-1',
            order: 'order-1',
            quantity: 200,
            shippedOn: '2026-03-01',
          },
        },
      ],
      {
        parts: new Map([['part-1', { id: 'part-1', data: { partNo: 'BRK-08' } }]]),
        orders: new Map([['order-1', { id: 'order-1', data: { number: 'SO-202603010001', customer: 'cust-1' } }]]),
        customers: new Map([['cust-1', { id: 'cust-1', data: { name: '宁波华兴' } }]]),
      },
    )
    expect(result.found).toBe(true)
    expect(result.hits).toEqual([
      {
        batchId: 'batch-1',
        partId: 'part-1',
        partNo: 'BRK-08',
        quantity: 200,
        shippedOn: '2026-03-01',
        orderId: 'order-1',
        orderNumber: 'SO-202603010001',
        customerId: 'cust-1',
        customerName: '宁波华兴',
        notes: [],
      },
    ])
  })

  it('悬空引用不抛：字段给 null，notes 写明追到哪一步断了', () => {
    const result = assembleTraceability(
      'B-2026-001',
      [
        {
          id: 'batch-1',
          data: {
            batchNo: 'B-2026-001',
            part: 'ghost-part',
            order: 'ghost-order',
            quantity: 8,
            shippedOn: '2026-03-02',
          },
        },
      ],
      { parts: new Map(), orders: new Map(), customers: new Map() },
    )
    expect(result.found).toBe(true)
    expect(result.hits[0]).toMatchObject({
      batchId: 'batch-1',
      partId: 'ghost-part',
      partNo: null,
      orderId: 'ghost-order',
      orderNumber: null,
      customerId: null,
      customerName: null,
    })
    expect(result.hits[0]?.notes.join(' ')).toMatch(/零件/)
    expect(result.hits[0]?.notes.join(' ')).toMatch(/订单/)
  })

  it('订单在、客户悬空：追到订单号，客户字段 null 并注明', () => {
    const result = assembleTraceability(
      'B-1',
      [{ id: 'b1', data: { part: 'p1', order: 'o1', quantity: 1, shippedOn: '2026-01-01' } }],
      {
        parts: new Map([['p1', { id: 'p1', data: { partNo: 'X' } }]]),
        orders: new Map([['o1', { id: 'o1', data: { number: 'SO-1', customer: 'ghost-c' } }]]),
        customers: new Map(),
      },
    )
    expect(result.hits[0]).toMatchObject({
      orderNumber: 'SO-1',
      customerId: 'ghost-c',
      customerName: null,
    })
    expect(result.hits[0]?.notes.join(' ')).toMatch(/客户/)
  })
})
