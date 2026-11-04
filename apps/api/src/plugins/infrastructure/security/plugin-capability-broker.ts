/**
 * 插件能力中介 —— 判据见 `docs/protocols/plugin-sandbox.md` §2。
 *
 * 三件事，顺序固定：
 *   1. **归一**：把清单里**结构化**的权限声明（tables × operations、endpoints × methods …）
 *      摊平成**权限点**集合（`db:orders:read` / `api:GET:/api/orders` / `modules:extend:crm`）
 *   2. **判定**：把一次能力请求同样摊平成所需权限点，然后交给**原子那条线上已有的**
 *      `missingPermissions`（all-of：缺一个就拒）—— 不另写一份权限检查器
 *   3. **留痕**：拒绝与放行都写同一条审计出口，拒绝信息里必须写明**缺哪条声明**
 *
 * 为什么"归一成权限点"而不是直接比结构化对象：all-of 的语义与原子完全一致
 * （元语不变量 4/12），差的是**表示形式**。把差异收在归一函数里，判定就只剩一份。
 */
import { missingPermissions } from '../../../atomic-runtime/atomic-permissions'

/** 平台侧错误码（与协议文本里的名字一致）。 */
export const PLUGIN_CAPABILITY_DENIED = 'PLUGIN_CAPABILITY_DENIED'

export class PluginCapabilityError extends Error {
  constructor(
    readonly pluginName: string,
    readonly capability: string,
    readonly missing: string[],
  ) {
    super(
      `${PLUGIN_CAPABILITY_DENIED}：插件 ${pluginName} 请求 ${capability} 时缺少声明` +
        `（${missing.join('、')}）—— 未声明即拿不到，不是"被拒绝"而是"不存在"`,
    )
    this.name = 'PluginCapabilityError'
  }
}

export interface PluginPermissionDeclaration {
  api?: { endpoints?: string[]; methods?: string[] }
  database?: { tables?: string[]; operations?: string[] }
  ui?: { components?: string[]; pages?: string[] }
  modules?: { extend?: string[]; create?: boolean }
}

/** 能力请求 → 摊平后的权限点。全部按 `域:主体:动作` 三段式，便于逐项比对。 */
export function permissionPointsOf(permissions: PluginPermissionDeclaration): string[] {
  const points: string[] = []

  for (const table of permissions.database?.tables ?? []) {
    const operations = permissions.database?.operations ?? []
    for (const operation of operations) {
      points.push(`db:${table}:${operation}`)
    }
  }

  for (const endpoint of permissions.api?.endpoints ?? []) {
    const methods = permissions.api?.methods ?? []
    for (const method of methods) {
      points.push(`api:${method.toUpperCase()}:${endpoint}`)
    }
  }

  for (const name of permissions.modules?.extend ?? []) {
    points.push(`modules:extend:${name}`)
  }
  if (permissions.modules?.create) points.push('modules:create')

  return points
}

/** 一次能力请求需要哪些权限点（目前每条请求恰好对应一个点）。 */
export function requiredPointsFor(
  capability: string,
  args: Record<string, unknown>,
): string[] {
  switch (capability) {
    case 'database.read':
      return [`db:${String(args.table)}:read`]
    case 'database.write':
      return [`db:${String(args.table)}:write`]
    case 'database.delete':
      return [`db:${String(args.table)}:delete`]
    case 'api.call':
      return [`api:${String(args.method ?? 'GET').toUpperCase()}:${String(args.path)}`]
    case 'modules.extend':
      return [`modules:extend:${String(args.name)}`]
    case 'modules.create':
      return ['modules:create']
    case 'log.write':
      // 写日志不算能力：它不改任何数据，也不出网。仍然留审计。
      return []
    default:
      // 未知能力一律拒（而不是"没声明就等于不管"）
      return [`unknown:${capability}`]
  }
}

export interface CapabilityCheck {
  allowed: boolean
  /** 缺哪些声明（空数组表示放行）。 */
  missing: string[]
}

/**
 * 判定：清单声明能不能覆盖这次请求。
 *
 * 判定本体就是 `missingPermissions(required, granted)` —— 原子那条线上的 all-of。
 */
export function checkCapability(
  permissions: PluginPermissionDeclaration,
  capability: string,
  args: Record<string, unknown>,
): CapabilityCheck {
  const granted = permissionPointsOf(permissions)
  const required = requiredPointsFor(capability, args)
  const missing = missingPermissions(required, granted)
  return { allowed: missing.length === 0, missing }
}

/** 判定并抛错（平台侧调用方要的是"拒绝时抛什么"，不是"返回个 false"）。 */
export function assertCapability(
  pluginName: string,
  permissions: PluginPermissionDeclaration,
  capability: string,
  args: Record<string, unknown>,
): void {
  const check = checkCapability(permissions, capability, args)
  if (!check.allowed) {
    throw new PluginCapabilityError(pluginName, capability, check.missing)
  }
}

/**
 * 给 `PluginHostProcess` 用的判定者：返回 null 表示放行，返回字符串表示拒绝原因。
 *
 * 为什么返回字符串而不是抛错：这是子进程协议的边界 —— 拒绝要**回给插件**
 * （让它自己知道哪条声明没写），而不是把宿主进程炸掉。
 */
export function createAuthorizer(
  pluginName: string,
  permissions: PluginPermissionDeclaration,
): (capability: string, args: Record<string, unknown>) => string | null {
  return (capability, args) => {
    const check = checkCapability(permissions, capability, args)
    if (check.allowed) return null
    return (
      `${PLUGIN_CAPABILITY_DENIED}：缺少声明 ${check.missing.join('、')}` +
      `（插件 ${pluginName} 未在清单里声明该能力）`
    )
  }
}
