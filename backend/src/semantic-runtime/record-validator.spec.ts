import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  validateRecord,
  type SemanticEntity,
  type ValidationRule,
} from './record-validator'

const TEMPLATE = resolve(__dirname, '../../../templates/auto-parts-min')
const entities = (
  JSON.parse(readFileSync(joinTemplate('semantic.json'), 'utf8')) as { entities: SemanticEntity[] }
).entities
const validation = (
  JSON.parse(readFileSync(joinTemplate('rules.json'), 'utf8')) as { validation: ValidationRule[] }
).validation

function joinTemplate(name: string): string {
  return resolve(TEMPLATE, name)
}

function check(
  entity: string,
  data: Record<string, unknown>,
  refs: string[] = [],
) {
  return validateRecord({
    entities,
    validation,
    entity,
    data,
    existingRefs: new Set(refs),
  })
}

describe('validateRecord（六道链各一正一负）', () => {
  it('实体：已声明通过 / 未声明 unknown-entity', () => {
    const ok = check('Part', { partNo: 'P-1', name: '垫片' })
    expect(ok).toEqual({ ok: true })
    const bad = check('Ghost', { name: 'x' })
    expect(bad).toMatchObject({ ok: false, reason: 'unknown-entity' })
  })

  it('字段：已知通过 / 多余字段 unknown-field（不忽略）', () => {
    const ok = check('Part', { partNo: 'P-1' })
    expect(ok).toEqual({ ok: true })
    const bad = check('Part', { partNo: 'P-1', ghost: 1 })
    expect(bad).toMatchObject({ ok: false, reason: 'unknown-field', field: 'ghost' })
  })

  it('类型：匹配通过 / 数值字段传入文本 type-mismatch', () => {
    const ok = check('Supplier', { name: '甲', creditDays: 30 })
    expect(ok).toEqual({ ok: true })
    const bad = check('Supplier', { name: '甲', creditDays: '三十' })
    expect(bad).toMatchObject({ ok: false, reason: 'type-mismatch', field: 'creditDays' })
  })

  it('引用：目标存在通过 / 悬空 dangling-reference', () => {
    const ok = check(
      'SalesOrder',
      { quantity: 2, unitPrice: 10, customer: 'c1', part: 'p1' },
      ['Customer:c1', 'Part:p1'],
    )
    expect(ok).toEqual({ ok: true })
    const bad = check(
      'SalesOrder',
      { quantity: 2, unitPrice: 10, customer: 'missing', part: 'p1' },
      ['Part:p1'],
    )
    expect(bad).toMatchObject({ ok: false, reason: 'dangling-reference', field: 'customer' })
  })

  it('validation：quantity>0 通过 / quantity=0 被 so-qty-positive 拦', () => {
    const ok = check(
      'SalesOrder',
      { quantity: 1, unitPrice: 0, customer: 'c1', part: 'p1' },
      ['Customer:c1', 'Part:p1'],
    )
    expect(ok).toEqual({ ok: true })
    const bad = check(
      'SalesOrder',
      { quantity: 0, unitPrice: 10, customer: 'c1', part: 'p1' },
      ['Customer:c1', 'Part:p1'],
    )
    expect(bad).toMatchObject({
      ok: false,
      reason: 'validation-failed',
      ruleId: 'so-qty-positive',
    })
  })

  it('合法写入形状通过 / 缺 partNo 被 part-no-required 拦', () => {
    const ok = check('Part', { partNo: 'P-1', name: '垫片', unitCost: 1.5 })
    expect(ok).toEqual({ ok: true })
    const bad = check('Part', { name: '垫片' })
    expect(bad).toMatchObject({
      ok: false,
      reason: 'validation-failed',
      ruleId: 'part-no-required',
    })
  })

  it('greaterOrEqual：unitPrice=0 通过 / 负数被 so-price-nonneg 拦', () => {
    const ok = check(
      'SalesOrder',
      { quantity: 1, unitPrice: 0, customer: 'c1', part: 'p1' },
      ['Customer:c1', 'Part:p1'],
    )
    expect(ok).toEqual({ ok: true })
    const bad = check(
      'SalesOrder',
      { quantity: 1, unitPrice: -1, customer: 'c1', part: 'p1' },
      ['Customer:c1', 'Part:p1'],
    )
    expect(bad).toMatchObject({
      ok: false,
      reason: 'validation-failed',
      ruleId: 'so-price-nonneg',
    })
  })

  it('审批条件不被执行：高单价写入仍通过（when 不求值）', () => {
    const result = check(
      'SalesOrder',
      { quantity: 2, unitPrice: 200000, customer: 'c1', part: 'p1' },
      ['Customer:c1', 'Part:p1'],
    )
    expect(result).toEqual({ ok: true })
  })
})
