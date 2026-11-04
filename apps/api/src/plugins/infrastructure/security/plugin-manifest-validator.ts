/**
 * 插件清单校验 —— 判据文本见 `docs/protocols/plugin-sandbox.md` §3。
 *
 * 形状的权威是仓库根 `schemas/plugin-manifest.schema.json`；
 * 本模块只做两件事：**照章执行** + 补 Schema 表达不了的**跨字段判据**。
 * 判定只有这一份：`plugin-loader.service.ts` 不再自己写一份形状校验
 * （元语不变量 12：一份判定逻辑只写一次）。
 */
import { Validator } from 'jsonschema'
import {
  PLUGIN_MANIFEST_SCHEMA_FILE,
  loadSchema,
} from '../../../common/protocol/schema-loader'

export interface PluginManifestValidation {
  valid: boolean
  /** 人类可读的错误（含出错路径），空数组表示通过。 */
  errors: string[]
}

let validator: Validator | undefined

function getValidator(): Validator {
  if (!validator) validator = new Validator()
  return validator
}

/**
 * 跨字段判据：
 *
 *   1. 入口路径不得越出插件目录（绝对路径 / `..`）—— Schema 的 pattern 只是**第一道**，
 *      这里再按路径语义判一次：pattern 难穷尽（`a/./../b`、URL 编码、Windows 盘符）。
 *   2. 声明了的 `database.operations` 必须有 `tables` —— 只有操作没有表 = 声明不清，
 *      放行它等于让"能操作什么"变成运行时的猜测。
 *   3. 声明了 `routes` 就必须声明对应的 `api.endpoints` —— 否则插件能注册一个自己都没声明过的端点。
 */
export function validatePluginManifestConsistency(
  manifest: unknown,
): PluginManifestValidation {
  const errors: string[] = []
  const m = (manifest ?? {}) as {
    entry?: { backend?: string; frontend?: string }
    permissions?: {
      api?: { endpoints?: string[] }
      database?: { tables?: string[]; operations?: string[] }
    }
    routes?: Array<{ path?: string }>
  }

  for (const [field, value] of [
    ['entry.backend', m.entry?.backend],
    ['entry.frontend', m.entry?.frontend],
  ] as const) {
    if (!value) continue
    if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) {
      errors.push(`${field}: 不得是绝对路径（${value}）`)
      continue
    }
    const segments = value.split(/[\\/]/)
    if (segments.includes('..')) {
      errors.push(`${field}: 不得越出插件目录（${value}）`)
    }
  }

  const operations = m.permissions?.database?.operations ?? []
  const tables = m.permissions?.database?.tables ?? []
  if (operations.length > 0 && tables.length === 0) {
    errors.push(
      'permissions.database: 声明了 operations 却没有 tables —— 能操作什么必须是明确的',
    )
  }

  const endpoints = m.permissions?.api?.endpoints ?? []
  for (const route of m.routes ?? []) {
    if (route.path && !endpoints.includes(route.path)) {
      errors.push(
        `routes: ${route.path} 未在 permissions.api.endpoints 中声明 —— 插件不能注册自己都没声明过的端点`,
      )
    }
  }

  return { valid: errors.length === 0, errors }
}

/** 清单的完整校验：形状 + 跨字段一致性。 */
export function validatePluginManifest(manifest: unknown): PluginManifestValidation {
  const result = getValidator().validate(manifest, loadSchema(PLUGIN_MANIFEST_SCHEMA_FILE))
  if (!result.valid) {
    return {
      valid: false,
      errors: result.errors.map((error) => {
        const path = error.property.replace(/^instance\.?/, '') || '(root)'
        return `${path}: ${error.message}`
      }),
    }
  }
  return validatePluginManifestConsistency(manifest)
}
