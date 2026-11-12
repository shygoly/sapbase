import {
  assertToolCatalog,
  type AgentToolContract,
  type ToolCatalog,
} from './contracts-loader'

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
      tools.push(tool)
    }
  }

  return {
    appKey: appContext.appKey,
    appInstallationId: appContext.appInstallationId,
    tools,
    sources: sourceSummary,
  }
}
