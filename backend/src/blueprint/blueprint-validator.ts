import { Validator, type IJSONSchemaValidationError } from 'jsonschema'
import {
  BLUEPRINT_IR_SCHEMA_FILE,
  BLUEPRINT_PACKAGE_SCHEMA_FILE,
  loadSchema,
} from '../common/protocol/schema-loader'

export interface ProtocolValidationResult {
  valid: boolean
  /** 人类可读的错误（含出错路径）。 */
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

/** 形状校验：manifest 是否符合 blueprint-package.schema.json。 */
export function validateBlueprintManifest(
  manifest: unknown,
): ProtocolValidationResult {
  const result = getValidator().validate(manifest, loadSchema(BLUEPRINT_PACKAGE_SCHEMA_FILE))
  return { valid: result.valid, errors: formatErrors(result.errors) }
}

/** 形状校验：结构化 IR 是否符合 blueprint-ir.schema.json。 */
export function validateBlueprintIr(ir: unknown): ProtocolValidationResult {
  const result = getValidator().validate(ir, loadSchema(BLUEPRINT_IR_SCHEMA_FILE))
  return { valid: result.valid, errors: formatErrors(result.errors) }
}

/**
 * 跨字段一致性校验 —— **JSON Schema 表达不了的部分**，必须由校验器承担：
 *
 *   1. 每一层引用的文件都必须出现在 `files` 里
 *   2. `files` 里的每个文件都必须被至少一层覆盖（未声明的文件一律非法）
 *   3. 同一个文件不能出现在多层
 *
 * 为什么不硬塞进 Schema：draft-07 无法在数组之间做这类引用一致性判断；
 * 把它放这里，判定仍然只有一份（前端若需要，调同一接口而非自己实现）。
 */
export function validateManifestConsistency(
  manifest: unknown,
): ProtocolValidationResult {
  const errors: string[] = []
  const m = manifest as {
    layers?: Record<string, string[]>
    files?: Record<string, string>
  }
  const layers = m?.layers ?? {}
  const files = Object.keys(m?.files ?? {})

  const declared = new Set(files)
  const seen = new Map<string, string[]>()
  for (const [layer, paths] of Object.entries(layers)) {
    for (const path of paths ?? []) {
      if (!declared.has(path)) {
        errors.push(`layers.${layer}: 引用了 files 中不存在的文件 ${path}`)
      }
      const where = seen.get(path) ?? []
      where.push(layer)
      seen.set(path, where)
    }
  }

  for (const path of files) {
    if (!seen.has(path)) {
      errors.push(`files: ${path} 未被任何层覆盖（未声明的文件一律非法）`)
    }
  }

  for (const [path, where] of seen) {
    if (where.length > 1) {
      errors.push(`文件 ${path} 同时出现在多层：${where.join(', ')}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/** manifest 的全部校验：形状 + 一致性。 */
export function validateBlueprintPackage(
  manifest: unknown,
): ProtocolValidationResult {
  const shape = validateBlueprintManifest(manifest)
  if (!shape.valid) return shape
  return validateManifestConsistency(manifest)
}
