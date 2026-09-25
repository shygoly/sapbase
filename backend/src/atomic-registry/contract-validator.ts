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
} from './schema-loader'

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
  return validate(contract, CONTRACT_SCHEMA_FILE)
}

/** 校验一份准入清单（`wasm-modules/build/manifest.json` 的形态）。 */
export function validateModuleManifest(
  manifest: unknown,
): SchemaValidationResult {
  return validate(manifest, MANIFEST_SCHEMA_FILE)
}
