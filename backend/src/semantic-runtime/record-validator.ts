/**
 * 写入链的纯函数校验：输入（模板语义 + validation + 记录）→ 结论或原因。
 *
 * 不碰 IO。reference 是否存在由调用方传入已有 id 集合；
 * 审批 when / 记账 / 流程推进都不在这里 —— 那些本运行时明确不执行。
 */

export interface SemanticField {
  name: string
  type: string
  required?: boolean
  reference?: string
}

export interface SemanticEntity {
  name: string
  fields: SemanticField[]
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

function typeMatches(field: SemanticField, value: unknown): boolean {
  switch (field.type) {
    case 'text':
      return typeof value === 'string'
    case 'number':
    case 'decimal':
      return isFiniteNumber(value)
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

function applyValidation(
  rule: ValidationRule,
  value: unknown,
): boolean {
  switch (rule.rule) {
    case 'required':
      return value !== undefined && value !== null && value !== ''
    case 'greaterThan':
      return isFiniteNumber(value) && isFiniteNumber(rule.value) && value > rule.value
    case 'lessThan':
      return isFiniteNumber(value) && isFiniteNumber(rule.value) && value < rule.value
    case 'greaterOrEqual':
      return isFiniteNumber(value) && isFiniteNumber(rule.value) && value >= rule.value
    case 'lessOrEqual':
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
    if (!applyValidation(rule, input.data[rule.field])) {
      return fail('validation-failed', rule.message, { field: rule.field, ruleId: rule.id })
    }
  }

  return { ok: true }
}
