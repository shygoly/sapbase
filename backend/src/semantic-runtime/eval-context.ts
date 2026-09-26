/**
 * 判定点求值上下文：同实体 computed + 一层 rollup（行现算）。
 * 纯函数；查库由调用方传入行数据。
 */

import {
  addAligned,
  compare,
  DEFAULT_MONEY_ROUNDING,
  DEFAULT_MONEY_SCALE,
  type FixedDecimal,
  formatFixed,
  parseFixed,
  roundTo,
  type MoneyRounding,
} from '../blueprint/money'
import {
  asDecimal,
  evaluateComputed,
  type EvalContext,
  type EvalFieldType,
  parseDecimalInput,
} from '../blueprint/expression-evaluator'
import type { SemanticEntity, SemanticField } from './record-validator'

export interface RollupDecl {
  field: string
  over: string
  of: string
  fn: 'sum' | 'count' | 'max' | 'min'
}

export function fieldTypesOf(entity: SemanticEntity): Record<string, EvalFieldType> {
  const types: Record<string, EvalFieldType> = {}
  for (const field of entity.fields) {
    types[field.name] = { type: field.type, scale: field.scale, currency: field.currency }
  }
  return types
}

export function materializeComputed(
  entity: SemanticEntity,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const values = { ...data }
  const types = fieldTypesOf(entity)
  const computed = entity.fields.filter((field) => field.computed)
  const pending = new Set(computed.map((field) => field.name))
  let guard = computed.length + 1
  while (pending.size > 0 && guard > 0) {
    guard -= 1
    let progressed = false
    for (const field of computed) {
      if (!pending.has(field.name) || !field.computed) continue
      if (field.computed.dependsOn.some((dep) => pending.has(dep))) continue
      const result = evaluateComputed(field.computed.expr, { values, types })
      if (!result.ok) {
        throw new Error(`计算字段 ${entity.name}.${field.name}：${result.error}`)
      }
      values[field.name] = writeFieldValue(field, result.value.tag === 'decimal' || result.value.tag === 'int'
        ? asDecimal(result.value)
        : result.value.tag === 'number'
          ? result.value.value
          : result.value.tag === 'string'
            ? result.value.value
            : result.value.value)
      pending.delete(field.name)
      progressed = true
    }
    if (!progressed) break
  }
  return values
}

export function computeRollupValue(
  entity: SemanticEntity,
  rollup: RollupDecl,
  childEntity: SemanticEntity,
  childRows: Array<Record<string, unknown>>,
): unknown {
  const target = entity.fields.find((field) => field.name === rollup.field)
  if (!target) throw new Error(`rollup 字段 ${entity.name}.${rollup.field} 未声明`)
  const ofField = childEntity.fields.find((field) => field.name === rollup.of)
  if (!ofField) throw new Error(`rollup of ${childEntity.name}.${rollup.of} 未声明`)

  if (rollup.fn === 'count') {
    return childRows.length
  }

  const materialized = childRows.map((row) => materializeComputed(childEntity, row))
  const decimals: FixedDecimal[] = materialized.map((row) => {
    const raw = row[rollup.of]
    if (ofField.type === 'decimal') {
      return parseDecimalInput(raw, ofField.scale ?? DEFAULT_MONEY_SCALE, `${childEntity.name}.${rollup.of}`)
    }
    if (typeof raw === 'number' && Number.isInteger(raw)) {
      return parseFixed(String(raw), 0)
    }
    throw new Error(`rollup ${rollup.fn} 无法读取 ${childEntity.name}.${rollup.of}`)
  })

  if (decimals.length === 0) {
    return writeFieldValue(target, parseFixed('0', target.scale ?? DEFAULT_MONEY_SCALE))
  }

  let acc = decimals[0]
  for (const item of decimals.slice(1)) {
    if (rollup.fn === 'sum') acc = addAligned(acc, item)
    else if (rollup.fn === 'max') acc = compare(item, acc) > 0 ? item : acc
    else acc = compare(item, acc) < 0 ? item : acc
  }
  return writeFieldValue(target, acc)
}

export function buildEvalContext(
  entity: SemanticEntity,
  data: Record<string, unknown>,
  childRowsByEntity: Record<string, Array<Record<string, unknown>>>,
  entities: SemanticEntity[],
): EvalContext {
  const values = materializeComputed(entity, data)
  const types = fieldTypesOf(entity)
  for (const rollup of (entity.rollups ?? []) as RollupDecl[]) {
    const child = entities.find((item) => item.name === rollup.over)
    if (!child) throw new Error(`rollup over ${rollup.over} 未声明`)
    values[rollup.field] = computeRollupValue(
      entity,
      rollup,
      child,
      childRowsByEntity[rollup.over] ?? [],
    )
  }
  return { values, types }
}

function writeFieldValue(field: SemanticField, value: FixedDecimal | number | boolean | string): unknown {
  if (typeof value !== 'object') return value
  const scale = field.scale ?? DEFAULT_MONEY_SCALE
  const rounding = (field.rounding ?? DEFAULT_MONEY_ROUNDING) as MoneyRounding
  return formatFixed(roundTo(value, scale, rounding))
}
