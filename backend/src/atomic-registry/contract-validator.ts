// 原子契约与模块清单的校验。
//
// 判定权威是仓库根 `schemas/*.schema.json`，本模块只做"照章执行"：
//   · validateAtomicContract —— 契约必须是 v1 允许的形态（calculation / query；
//     Wasm 实现必须能指认模块哈希；Tier B 必须有审查背书）
//   · validateModuleManifest —— 准入清单必须结构完整
//
// 注意：**清单通过校验不等于模块可信**。清单只是准入记录，
// 宿主导入时仍 MUST 对字节重算 SHA-256（元语不变量 3：判定权在平台）。
import {
  Validator,
  type IJSONSchemaValidationError,
} from 'jsonschema'
import {
  CONTRACT_SCHEMA_FILE,
  MANIFEST_SCHEMA_FILE,
  loadSchema,
} from '../common/protocol/schema-loader'

export interface SchemaValidationResult {
  valid: boolean
  /** 人类可读的错误列表（含出错路径），空数组表示通过。 */
  errors: string[]
}

let validator: Validator | undefined

function getValidator(): Validator {
  if (!validator) validator = new Validator()
  return validator
}

function formatErrors(errors: IJSONSchemaValidationError[]): string[] {
  return errors.map((err) => {
    const path = err.property.replace(/^instance\.?/, '') || '(root)'
    return `${path}: ${err.message}`
  })
}

function validate(
  instance: unknown,
  schemaFile: string,
): SchemaValidationResult {
  const schema = loadSchema(schemaFile)
  const result = getValidator().validate(instance, schema)
  return {
    valid: result.valid,
    errors: formatErrors(result.errors),
  }
}

/**
 * 校验一份原子契约。
 *
 * fail-closed：调用方 MUST 在 `valid === false` 时拒绝登记该契约，
 * 而不是"记录警告后放行"。
 */
export function validateAtomicContract(
  contract: unknown,
): SchemaValidationResult {
  const shape = validate(contract, CONTRACT_SCHEMA_FILE)
  if (!shape.valid) return shape
  return validateContractConsistency(contract)
}

/**
 * 契约的**跨字段一致性** —— JSON Schema 表达不了的部分。
 *
 * 两条判据，都是确定性的：
 *   1. 输出列的 `minimum` 不得大于 `maximum`（值域倒置的声明，闸 3 判不了它）
 *   2. 汇总位名字不得与某个输出列同名（否则输出布局有歧义，宿主回填时无处安放）
 *
 * 为什么放校验器而不是硬塞进 Schema：draft-07 无法在数组元素之间做这类判断；
 * 放这里判定仍然只有一份（元语不变量 12），前端若需要则调用同一入口。
 */
export function validateContractConsistency(
  contract: unknown,
): SchemaValidationResult {
  const errors: string[] = []
  const output = (contract as { outputSchema?: { columns?: unknown; total?: unknown } })
    ?.outputSchema
  const columns = Array.isArray(output?.columns)
    ? (output.columns as Array<{ name?: string; minimum?: number; maximum?: number }>)
    : []

  for (const column of columns) {
    const { name, minimum, maximum } = column
    if (typeof minimum === 'number' && typeof maximum === 'number' && minimum > maximum) {
      errors.push(
        `outputSchema.columns.${name}: minimum (${minimum}) 不得大于 maximum (${maximum})`,
      )
    }
  }

  const totalName = (output?.total as { name?: string } | undefined)?.name
  if (totalName && columns.some((column) => column.name === totalName)) {
    errors.push(
      `outputSchema.total.name: 汇总位名字 ${totalName} 与输出列同名（输出布局有歧义）`,
    )
  }

  return { valid: errors.length === 0, errors }
}

/** 校验一份准入清单（`wasm-modules/build/manifest.json` 的形态）。 */
export function validateModuleManifest(
  manifest: unknown,
): SchemaValidationResult {
  return validate(manifest, MANIFEST_SCHEMA_FILE)
}
