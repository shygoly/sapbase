// 协议 Schema 的定位与加载（**通用工具**，被原子注册表与蓝图编译器共用）。
//
// 权威定义在仓库根 `schemas/*.schema.json`：语言中立的协议产物，前后端与外部工具消费同一份，
// 避免"每端各写一套判定"（元语不变量 12）。本模块只负责找到并读入，不做任何判定。
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export const CONTRACT_SCHEMA_FILE = 'atomic-contract.schema.json'
export const MANIFEST_SCHEMA_FILE = 'atomic-module-manifest.schema.json'
export const BLUEPRINT_PACKAGE_SCHEMA_FILE = 'blueprint-package.schema.json'
export const BLUEPRINT_IR_SCHEMA_FILE = 'blueprint-ir.schema.json'

/** 向上查找的最大层数：backend/src/xxx → backend → 仓库根 */
const MAX_WALK_UP = 8

let cachedDir: string | undefined

/**
 * 定位 `schemas/` 目录。
 *
 * 开发与测试时从 `backend/src/...` 向上找，编译后从 `backend/dist/...` 向上找，
 * 两种形态都能命中仓库根的 `schemas/`。可用 `SPECKIT_SCHEMAS_DIR` 显式覆盖
 * （容器化部署时 schema 可能挂载在其他路径）。
 */
export function resolveSchemasDir(startDir: string = __dirname): string {
  const override = process.env.SPECKIT_SCHEMAS_DIR
  if (override && override.trim().length > 0) return override
  if (cachedDir) return cachedDir

  let dir = resolve(startDir)
  for (let i = 0; i < MAX_WALK_UP; i += 1) {
    if (existsSync(join(dir, 'schemas', CONTRACT_SCHEMA_FILE))) {
      cachedDir = join(dir, 'schemas')
      return cachedDir
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(
    `未找到协议 Schema 目录：从 ${startDir} 向上 ${MAX_WALK_UP} 层都未见 schemas/${CONTRACT_SCHEMA_FILE}`,
  )
}

const schemaCache = new Map<string, Record<string, unknown>>()

/** 读入并缓存一个协议 Schema（只读，不执行任何被校验的内容）。 */
export function loadSchema(fileName: string): Record<string, unknown> {
  const cached = schemaCache.get(fileName)
  if (cached) return cached

  const path = join(resolveSchemasDir(), fileName)
  if (!existsSync(path)) {
    throw new Error(`协议 Schema 不存在：${path}`)
  }
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  schemaCache.set(fileName, parsed)
  return parsed
}

/** 测试用：清空缓存，使更换 SPECKIT_SCHEMAS_DIR 后重新解析。 */
export function clearSchemaCache(): void {
  schemaCache.clear()
  cachedDir = undefined
}
