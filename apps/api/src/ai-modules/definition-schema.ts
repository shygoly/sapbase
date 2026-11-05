import { BadRequestException } from '@nestjs/common'
import { Validator, type IJSONSchemaValidationError } from 'jsonschema'
import { loadSchema } from '@sap/platform-core/common/protocol/schema-loader'
import type { DefinitionStepId } from './definition-step-prompts'

/**
 * AI 六步定义的唯一 Schema 判据。
 *
 * 为什么不用 prompt 兜底：模型输出是外部输入，必须在返回/入库前过同一份
 * JSON Schema；否则“保存成功”只代表 JSON.parse 成功，不代表形状正确。
 */
const STEP_SCHEMA: Record<DefinitionStepId, string> = {
  'object-model': 'ai-definition-object-model.schema.json',
  relationships: 'ai-definition-relationships.schema.json',
  'state-flow': 'ai-definition-state-flow.schema.json',
  pages: 'ai-definition-pages.schema.json',
  permissions: 'ai-definition-permissions.schema.json',
  reports: 'ai-definition-reports.schema.json',
}

const STEP_KEYS: Record<DefinitionStepId, string[]> = {
  'object-model': ['objectModel', 'step1_objectModel'],
  relationships: ['relationships', 'step2_relationships'],
  'state-flow': ['stateFlow', 'step3_stateFlow'],
  pages: ['pages', 'step4_pages'],
  permissions: ['permissions', 'step5_permissions'],
  reports: ['reports', 'step6_reports'],
}

let validator: Validator | undefined

function getValidator(): Validator {
  if (!validator) validator = new Validator()
  return validator
}

function formatErrors(errors: IJSONSchemaValidationError[]): string[] {
  return errors.map((error) => {
    const path = error.property.replace(/^instance\.?/, '') || '(root)'
    return `${path}: ${error.message}`
  })
}

/** 六步产物可能包在 `{ generated }` 里；校验前先拆掉。 */
export function unwrapGenerated(value: unknown): unknown {
  let current = value
  while (
    current !== null &&
    typeof current === 'object' &&
    !Array.isArray(current) &&
    'generated' in (current as Record<string, unknown>)
  ) {
    current = (current as Record<string, unknown>).generated
  }
  return current
}

export interface DefinitionValidationResult {
  valid: boolean
  errors: string[]
}

export function validateDefinitionStep(
  stepId: DefinitionStepId,
  value: unknown,
): DefinitionValidationResult {
  const schemaFile = STEP_SCHEMA[stepId]
  if (!schemaFile) {
    return { valid: false, errors: [`未知的定义步骤：${stepId}`] }
  }
  const target = unwrapGenerated(value)
  const result = getValidator().validate(target, loadSchema(schemaFile))
  return { valid: result.valid, errors: formatErrors(result.errors) }
}

export function assertDefinitionStep(stepId: DefinitionStepId, value: unknown): void {
  const result = validateDefinitionStep(stepId, value)
  if (!result.valid) {
    throw new BadRequestException({
      message: `AI 定义步骤 ${stepId} 未通过 Schema 校验`,
      stepId,
      errors: result.errors,
    })
  }
}

function firstStepValue(definition: Record<string, unknown>, stepId: DefinitionStepId): unknown {
  for (const key of STEP_KEYS[stepId]) {
    if (definition[key] !== undefined && definition[key] !== null) return definition[key]
  }
  return undefined
}

/**
 * 保存前校验：只校验**存在**的步骤；step3 的 normalizer 仍由调用方先跑。
 * 这样部分定义（例如从旧库读出的缺步定义）不会被误判为非法。
 */
export function assertMergedDefinition(definition: Record<string, unknown>): void {
  for (const stepId of Object.keys(STEP_SCHEMA) as DefinitionStepId[]) {
    const value = firstStepValue(definition, stepId)
    if (value === undefined) continue
    assertDefinitionStep(stepId, value)
  }
}
