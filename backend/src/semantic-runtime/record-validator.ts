import { compare, DEFAULT_MONEY_SCALE, MoneyError, parseFixed } from '../blueprint/money'

/**
 * 写入链的纯函数校验：输入（模板语义 + validation + 记录）→ 结论或原因。
 *
 * 不碰 IO。reference 是否存在由调用方传入已有 id 集合；
 * 审批 when / 记账 / 流程推进的**求值**不在这里（见 expression-evaluator）。
 */

export interface SemanticField {
  name: string
  type: string
  required?: boolean
  reference?: string
  unique?: boolean
  onDelete?: 'restrict' | 'setNull'
  money?: boolean
  currency?: string
  permissions?: { read?: string; write?: string }
  precision?: number
  scale?: number
  rounding?: 'half-up' | 'half-even'
  values?: string[]
  computed?: { expr: string; dependsOn: string[] }
  /** 声明式默认值：只影响读路径 materialize 与升级，不绕过写入必填。 */
  default?: unknown
}

export interface SemanticNumberingDecl {
  field: string
  prefix: string
  dateFormat?: 'YYYYMMDD' | 'YYYYMM' | 'YYYY' | 'none'
  width: number
}

export interface SemanticEntity {
  name: string
  fields: SemanticField[]
  children?: string[]
  parent?: { entity: string; field: string }
  states?: Array<{ name: string; initial?: boolean; final?: boolean }>
  transitions?: Array<{ from: string; to: string; rule?: string }>
  numbering?: SemanticNumberingDecl
  rollups?: Array<{ field: string; over: string; of: string; fn: 'sum' | 'count' | 'max' | 'min' }>
  ownership?: { field: string; readAllPermission: string }
}

export interface ValidationRule {
  id: string
  entity: string
  field: string
  rule: string
  value?: unknown
  message: string
}

export type RecordRejectReason =
  | 'unknown-entity'
  | 'unknown-field'
  | 'type-mismatch'
  | 'dangling-reference'
  | 'validation-failed'

export type RecordValidationOk = { ok: true }
export type RecordValidationFail = {
  ok: false
  reason: RecordRejectReason
  detail: string
  field?: string
  ruleId?: string
}
export type RecordValidationResult = RecordValidationOk | RecordValidationFail

export interface ValidateRecordInput {
  entities: SemanticEntity[]
  validation: ValidationRule[]
  entity: string
  data: Record<string, unknown>
  /** 已存在的引用目标，键为 `${entity}:${id}`（同 blueprint + 同租户）。 */
  existingRefs: ReadonlySet<string>
}

const I32_MIN = -2147483648
const I32_MAX = 2147483647
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

function fail(
  reason: RecordRejectReason,
  detail: string,
  extra: { field?: string; ruleId?: string } = {},
): RecordValidationFail {
  return { ok: false, reason, detail, ...extra }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

const DECIMAL_TEXT = /^-?\d+(\.\d+)?$/

function isDecimalInput(value: unknown): boolean {
  return isFiniteNumber(value) || (typeof value === 'string' && DECIMAL_TEXT.test(value))
}

function typeMatches(field: SemanticField, value: unknown): boolean {
  switch (field.type) {
    case 'text':
    case 'enum':
      return typeof value === 'string'
    case 'number':
      return isFiniteNumber(value)
    case 'decimal':
      return isDecimalInput(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'date':
      return typeof value === 'string' && DATE_RE.test(value)
    case 'datetime':
      return typeof value === 'string' && DATETIME_RE.test(value)
    case 'i32':
      return Number.isInteger(value) && (value as number) >= I32_MIN && (value as number) <= I32_MAX
    case 'reference':
      return typeof value === 'string' && value.length > 0
    default:
      return false
  }
}

function decimalText(value: unknown): string | null {
  if (typeof value === 'string' && DECIMAL_TEXT.test(value)) return value
  if (isFiniteNumber(value)) {
    if (Number.isInteger(value)) return String(value)
    const text = String(value)
    return DECIMAL_TEXT.test(text) ? text : null
  }
  return null
}

function compareDecimal(value: unknown, ruleValue: unknown, scale: number): number | null {
  const leftText = decimalText(value)
  const rightText = decimalText(ruleValue)
  if (leftText === null || rightText === null) return null
  try {
    return compare(parseFixed(leftText, scale), parseFixed(rightText, scale))
  } catch (error) {
    if (error instanceof MoneyError) return null
    throw error
  }
}

function applyValidation(
  rule: ValidationRule,
  value: unknown,
  field?: SemanticField,
): boolean {
  const decimalScale = field?.type === 'decimal' ? (field.scale ?? DEFAULT_MONEY_SCALE) : undefined
  switch (rule.rule) {
    case 'required':
      return value !== undefined && value !== null && value !== ''
    case 'greaterThan':
      if (decimalScale !== undefined) {
        const rel = compareDecimal(value, rule.value, decimalScale)
        return rel !== null && rel > 0
      }
      return isFiniteNumber(value) && isFiniteNumber(rule.value) && value > rule.value
    case 'lessThan':
      if (decimalScale !== undefined) {
        const rel = compareDecimal(value, rule.value, decimalScale)
        return rel !== null && rel < 0
      }
      return isFiniteNumber(value) && isFiniteNumber(rule.value) && value < rule.value
    case 'greaterOrEqual':
      if (decimalScale !== undefined) {
        const rel = compareDecimal(value, rule.value, decimalScale)
        return rel !== null && rel >= 0
      }
      return isFiniteNumber(value) && isFiniteNumber(rule.value) && value >= rule.value
    case 'lessOrEqual':
      if (decimalScale !== undefined) {
        const rel = compareDecimal(value, rule.value, decimalScale)
        return rel !== null && rel <= 0
      }
      return isFiniteNumber(value) && isFiniteNumber(rule.value) && value <= rule.value
    case 'minLength':
      return typeof value === 'string' && typeof rule.value === 'number' && value.length >= rule.value
    case 'maxLength':
      return typeof value === 'string' && typeof rule.value === 'number' && value.length <= rule.value
    case 'pattern':
      return typeof value === 'string' && typeof rule.value === 'string' && new RegExp(rule.value).test(value)
    case 'oneOf':
      return Array.isArray(rule.value) && rule.value.includes(value)
    case 'unique':
      // 字面量比较做不到唯一性；调用方若传入此规则，fail-closed 拒绝而不是假装通过
      return false
    default:
      return false
  }
}

/**
 * 固定顺序：实体已声明 → 字段名都已知 → 类型匹配 → reference 存在 → validation。
 * 装载与落库在 service 里，不在这个纯函数里。
 */
export function validateRecord(input: ValidateRecordInput): RecordValidationResult {
  const entity = input.entities.find((item) => item.name === input.entity)
  if (!entity) {
    return fail('unknown-entity', `模板未声明实体 ${input.entity}`)
  }

  const declared = new Map(entity.fields.map((field) => [field.name, field]))
  for (const key of Object.keys(input.data)) {
    if (!declared.has(key)) {
      return fail('unknown-field', `实体 ${input.entity} 未声明字段 ${key}`, { field: key })
    }
  }

  for (const field of entity.fields) {
    const value = input.data[field.name]
    if (value === undefined) {
      if (field.required) {
        return fail('type-mismatch', `实体 ${input.entity} 缺必填字段 ${field.name}`, {
          field: field.name,
        })
      }
      continue
    }
    if (!typeMatches(field, value)) {
      return fail(
        'type-mismatch',
        `字段 ${input.entity}.${field.name} 期望 ${field.type}，实际 ${typeof value}`,
        { field: field.name },
      )
    }
    if (field.type === 'reference' && field.reference) {
      const refKey = `${field.reference}:${String(value)}`
      if (!input.existingRefs.has(refKey)) {
        return fail(
          'dangling-reference',
          `字段 ${input.entity}.${field.name} 指向不存在的 ${field.reference} 实例`,
          { field: field.name },
        )
      }
    }
  }

  for (const rule of input.validation.filter((item) => item.entity === input.entity)) {
    if (!applyValidation(rule, input.data[rule.field], declared.get(rule.field))) {
      return fail('validation-failed', rule.message, { field: rule.field, ruleId: rule.id })
    }
  }

  return { ok: true }
}

/**
 * 读路径补默认值：只填当前模板声明了 `default`、且记录里**缺少**的字段。
 * 不补 required 且无 default 的字段；不改传入对象（调用方负责是否写回 —— 读路径不得写回）。
 */
export function materializeDefaults(
  entity: Pick<SemanticEntity, 'fields'>,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...data }
  for (const field of entity.fields) {
    if (field.default === undefined) continue
    if (!Object.prototype.hasOwnProperty.call(next, field.name) || next[field.name] === undefined) {
      next[field.name] = field.default
    }
  }
  return next
}
