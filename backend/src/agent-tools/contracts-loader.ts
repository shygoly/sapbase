/**
 * 工具契约文件的定位与加载。
 *
 * 权威文件在仓库根 `contracts/tools.json`。定位方式与协议 Schema 相同：
 * 从 `__dirname` 向上找，支持 `SPECKIT_CONTRACTS_DIR` 覆盖。
 * **不要**用 `process.cwd()` 硬编码相对路径。
 *
 * 判定复用 `validateToolCatalog`（形状 / 跨字段 / 重名），再补 D1：
 * 每个工具声明的 permission 必须 ∈ `TOOL_PERMISSION_CATALOG`，否则契约非法。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { validateToolCatalog } from '../chat/chat-protocol-validator'
import { isSupportedToolPermission } from './tool-permissions'

export const TOOLS_CONTRACT_FILE = 'tools.json'

/** 向上查找的最大层数：backend/src/xxx → backend → 仓库根 */
const MAX_WALK_UP = 8

export interface AgentToolContract {
  name: string
  description: string
  parameters: Record<string, unknown>
  permission: string
  write: boolean
  confirmation: 'none' | 'required'
  timeoutMs?: number
  untrustedResult?: boolean
  sensitiveArgs?: string[]
  agentInvocable?: boolean
  allowedAgents?: string[]
}

export interface ToolCatalog {
  version: 1
  tools: AgentToolContract[]
}

let cachedDir: string | undefined
let cachedCatalog: ToolCatalog | undefined

/**
 * 定位 `contracts/` 目录。
 *
 * 可用 `SPECKIT_CONTRACTS_DIR` 显式覆盖（容器化部署时契约可能挂在其他路径）。
 */
export function resolveContractsDir(startDir: string = __dirname): string {
  const override = process.env.SPECKIT_CONTRACTS_DIR
  if (override && override.trim().length > 0) return override
  if (cachedDir) return cachedDir

  let dir = resolve(startDir)
  for (let i = 0; i < MAX_WALK_UP; i += 1) {
    if (existsSync(join(dir, 'contracts', TOOLS_CONTRACT_FILE))) {
      cachedDir = join(dir, 'contracts')
      return cachedDir
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(
    `未找到工具契约目录：从 ${startDir} 向上 ${MAX_WALK_UP} 层都未见 contracts/${TOOLS_CONTRACT_FILE}`,
  )
}

/**
 * 形状 + 权限点存在性。失败时错误信息指向具体工具与权限点。
 */
export function assertToolCatalog(catalog: unknown): ToolCatalog {
  const shape = validateToolCatalog(catalog)
  if (!shape.valid) {
    throw new Error(`工具契约非法：${shape.errors.join('; ')}`)
  }

  const parsed = catalog as ToolCatalog
  parsed.tools.forEach((tool, index) => {
    if (!isSupportedToolPermission(tool.permission)) {
      throw new Error(
        `tools[${index}].permission: 权限点「${tool.permission}」不在平台支持清单 TOOL_PERMISSION_CATALOG 中` +
          '（清单是协议面：平台支持什么；permissions 表才是组织授予了什么）',
      )
    }
  })
  return parsed
}

/** 读入并缓存仓库根的工具契约（只读）。 */
export function loadToolCatalog(): ToolCatalog {
  if (cachedCatalog) return cachedCatalog
  const path = join(resolveContractsDir(), TOOLS_CONTRACT_FILE)
  if (!existsSync(path)) {
    throw new Error(`工具契约不存在：${path}`)
  }
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
  cachedCatalog = assertToolCatalog(parsed)
  return cachedCatalog
}

/** 测试用：清空缓存，使更换 SPECKIT_CONTRACTS_DIR 后重新解析。 */
export function clearContractsCache(): void {
  cachedDir = undefined
  cachedCatalog = undefined
}
