import {
  assertToolCatalog,
  type AgentToolContract,
  type ToolCatalog,
} from './contracts-loader'
import type { AgentProfile } from './agent-profile'
import { isAgentAllowed } from './agent-tool.registry'

export type AppToolCatalogSourceKind =
  | 'platform'
  | 'blueprint'
  | 'integration'
  | 'shared'

export interface AppToolCatalogSource {
  kind: AppToolCatalogSourceKind
  /** 用于错误信息/可观测性；缺省用 kind。 */
  label?: string
  catalog: ToolCatalog
}

export interface ComposedAppToolCatalog {
  appKey: string
  appInstallationId: string
  tools: AgentToolContract[]
  sources: Array<{
    kind: AppToolCatalogSourceKind
    label: string
    count: number
  }>
  /** 工具名 → 来源 kind；过滤 entitlement 时区分平台内建与应用工具。 */
  sourceByTool: Record<string, AppToolCatalogSourceKind>
}

export interface AppToolCatalogFilter {
  /** 可信运行时身份；HTTP/chat 固定 runtime，MCP 宿主由受控 env 解析。 */
  agentProfile: AgentProfile
  /** 用户功能权限点；工具 permission 必须命中。 */
  grantedPermissions: readonly string[]
  /**
   * 应用 entitlement 显式授权的工具名。缺省表示不做 entitlement 过滤；
   * 提供时非平台工具必须在列表中，平台内建不受影响。
   */
  entitledToolNames?: readonly string[]
}

export interface AppToolCatalogFilterResult extends ComposedAppToolCatalog {
  filtered: {
    total: number
    visible: number
    hidden: Array<{ name: string; reason: 'agent' | 'permission' | 'entitlement' }>
  }
}

export class AppToolCatalogError extends Error {
  constructor(
    message: string,
    readonly reason: 'duplicate' | 'namespace' | 'invalid',
  ) {
    super(message)
    this.name = 'AppToolCatalogError'
  }
}

/**
 * 应用级工具目录组合（3.1/3.2）。
 *
 * - platform built-ins 可保留平台命名空间；
 * - Blueprint/integration/shared 工具必须使用 `${appKey}_` 命名空间；
 * - 任一重名或非法契约使整个目录无效（不静默去重）。
 *
 * 过滤（Agent/权限/entitlement/profile）由 4.4b 在组合之后执行。
 */
export function composeAppToolCatalog(
  appContext: { appKey: string; appInstallationId: string },
  sources: AppToolCatalogSource[],
): ComposedAppToolCatalog {
  if (!appContext.appKey) {
    throw new AppToolCatalogError('缺少 appKey，无法组合工具目录', 'invalid')
  }
  if (!appContext.appInstallationId) {
    throw new AppToolCatalogError('缺少 appInstallationId，无法组合工具目录', 'invalid')
  }
  const prefix = `${appContext.appKey}_`
  const seen = new Map<string, string>()
  const tools: AgentToolContract[] = []
  const sourceSummary: ComposedAppToolCatalog['sources'] = []
  const sourceByTool: Record<string, AppToolCatalogSourceKind> = {}

  for (const source of sources) {
    let catalog: ToolCatalog
    try {
      catalog = assertToolCatalog(source.catalog)
    } catch (error) {
      throw new AppToolCatalogError(
        `${source.label ?? source.kind} 工具契约非法：${
          error instanceof Error ? error.message : String(error)
        }`,
        'invalid',
      )
    }
    sourceSummary.push({
      kind: source.kind,
      label: source.label ?? source.kind,
      count: catalog.tools.length,
    })
    for (const tool of catalog.tools) {
      if (source.kind !== 'platform' && !tool.name.startsWith(prefix)) {
        throw new AppToolCatalogError(
          `${source.label ?? source.kind} 工具 ${tool.name} 必须使用应用命名空间 ${prefix}`,
          'namespace',
        )
      }
      const existing = seen.get(tool.name)
      if (existing) {
        throw new AppToolCatalogError(
          `工具名重复：${tool.name}（${existing} 与 ${source.label ?? source.kind}）`,
          'duplicate',
        )
      }
      seen.set(tool.name, source.label ?? source.kind)
      sourceByTool[tool.name] = source.kind
      tools.push(tool)
    }
  }

  return {
    appKey: appContext.appKey,
    appInstallationId: appContext.appInstallationId,
    tools,
    sources: sourceSummary,
    sourceByTool,
  }
}

/**
 * 组合后过滤（4.4b）：Agent 身份 → 用户权限 → 应用 entitlement。
 * 只返回可见工具；隐藏原因保留用于可观测性，不进入模型上下文。
 */
export function filterAppToolCatalog(
  catalog: ComposedAppToolCatalog,
  filter: AppToolCatalogFilter,
): AppToolCatalogFilterResult {
  const entitled = filter.entitledToolNames
    ? new Set(filter.entitledToolNames)
    : null
  const permissions = new Set(filter.grantedPermissions)
  const visible: AgentToolContract[] = []
  const hidden: AppToolCatalogFilterResult['filtered']['hidden'] = []

  for (const tool of catalog.tools) {
    if (!isAgentAllowed(tool, filter.agentProfile)) {
      hidden.push({ name: tool.name, reason: 'agent' })
      continue
    }
    if (!permissions.has(tool.permission)) {
      hidden.push({ name: tool.name, reason: 'permission' })
      continue
    }
    if (
      entitled &&
      catalog.sourceByTool[tool.name] !== 'platform' &&
      !entitled.has(tool.name)
    ) {
      hidden.push({ name: tool.name, reason: 'entitlement' })
      continue
    }
    visible.push(tool)
  }

  return {
    ...catalog,
    tools: visible,
    filtered: {
      total: catalog.tools.length,
      visible: visible.length,
      hidden,
    },
  }
}
