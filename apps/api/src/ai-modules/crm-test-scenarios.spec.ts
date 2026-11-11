import { coverageFor, runAllCrmScenarios } from './crm-test-scenarios'
import { diffJson } from './ai-modules.service'

const validObjects = {
  Customer: {
    name: 'Customer',
    fields: [
      { name: 'id', type: 'uuid' },
      { name: 'name', type: 'string' },
      { name: 'email', type: 'string' },
    ],
    relations: [{ name: 'orders', type: 'hasMany', target: 'Order' }],
  },
  Order: {
    name: 'Order',
    fields: [
      { name: 'id', type: 'uuid' },
      { name: 'orderNo', type: 'string' },
      { name: 'total', type: 'decimal' },
      { name: 'status', type: 'string' },
    ],
    relations: [{ name: 'customer', type: 'belongsTo', target: 'Customer' }],
  },
  OrderTracking: {
    name: 'OrderTracking',
    fields: [
      { name: 'id', type: 'uuid' },
      { name: 'orderId', type: 'uuid' },
      { name: 'status', type: 'string' },
      { name: 'timestamp', type: 'datetime' },
    ],
  },
  FinancialTransaction: {
    name: 'FinancialTransaction',
    fields: [
      { name: 'id', type: 'uuid' },
      { name: 'transactionNumber', type: 'string' },
      { name: 'amount', type: 'decimal' },
      { name: 'type', type: 'string' },
      { name: 'status', type: 'string' },
    ],
  },
}

describe('CRM test scenarios', () => {
  it('完整 CRM DSL：4 个实体全部通过，覆盖率 100%', () => {
    const results = runAllCrmScenarios({ objects: validObjects })
    expect(results.map((result) => result.status)).toEqual([
      'passed',
      'passed',
      'passed',
      'passed',
    ])
    expect(coverageFor(results)).toEqual({
      scenarios: 4,
      passed: 4,
      failed: 0,
      percent: 100,
      entities: 4,
    })
  })

  it('缺少实体：failed 并给出实体名', () => {
    const results = runAllCrmScenarios({
      objects: { Customer: validObjects.Customer },
    })
    expect(results[0].status).toBe('passed')
    expect(results[1].status).toBe('failed')
    expect(results[1].errors).toContain('patchContent 缺少实体 Order')
    expect(coverageFor(results)).toMatchObject({ passed: 1, failed: 3, percent: 25 })
  })

  it('缺少字段：failed 并列出候选字段', () => {
    const results = runAllCrmScenarios({
      objects: {
        ...validObjects,
        Customer: {
          name: 'Customer',
          fields: [{ name: 'id', type: 'uuid' }],
        },
      },
    })
    expect(results[0].status).toBe('failed')
    expect(results[0].errors.join(' ')).toContain('name / customerName')
    expect(results[0].coverage.percent).toBe(33)
  })

  it('兼容 semantic.entities 形状', () => {
    const results = runAllCrmScenarios({
      semantic: {
        entities: Object.values(validObjects),
      },
    })
    expect(results.every((result) => result.status === 'passed')).toBe(true)
  })
})

describe('diffJson', () => {
  it('输出新增/删除/修改的路径', () => {
    expect(
      diffJson(
        { a: 1, b: { c: 2 }, removed: true },
        { a: 2, b: { c: 2, d: 3 }, added: ['x'] },
      ),
    ).toEqual([
      { path: 'a', from: 1, to: 2 },
      { path: 'added', from: undefined, to: ['x'] },
      { path: 'b.d', from: undefined, to: 3 },
      { path: 'removed', from: true, to: undefined },
    ])
  })

  it('相同对象无 diff', () => {
    expect(diffJson({ a: [1, 2] }, { a: [1, 2] })).toEqual([])
  })
})
