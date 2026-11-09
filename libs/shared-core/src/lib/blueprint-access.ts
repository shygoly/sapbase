/**
 * Blueprint 权限层的纯判定。
 *
 * 规则来源：`permissions.json`（角色 → 资源 → 范围/动作）。
 * 平台 RBAC 仍是权限点；这里只把 AI 角色映射到权限点或 JWT role。
 */

export type BlueprintPermissionScope = 'own' | 'team' | 'all' | 'policy'
export type BlueprintPermissionAction = 'create' | 'read' | 'update' | 'delete' | 'list'

export interface BlueprintPermissionRule {
  role: string
  scope: BlueprintPermissionScope
  resources: string[]
  actions?: BlueprintPermissionAction[]
  dataScope?: {
    dimension: string
    depth: 'exact' | 'subtree' | 'ancestors'
    positions?: string[]
    relation?: { entity?: string; table?: string; fromField: string; actorField: string }
  }
}

export interface BlueprintPermissionsLayer {
  permissions: 'blueprint-permissions/v1' | string
  rules: BlueprintPermissionRule[]
  /** AI 角色 → 平台权限点；任一命中即视为该角色。缺省时匹配 JWT role 或同名权限点。 */
  roleMappings?: Record<string, string[]>
}

export interface BlueprintAccessActor {
  role?: string | null
  permissions?: readonly string[]
}

export function actorHasBlueprintRole(
  layer: BlueprintPermissionsLayer,
  ruleRole: string,
  actor: BlueprintAccessActor,
): boolean {
  const mapped = layer.roleMappings?.[ruleRole]
  if (mapped && mapped.length > 0) {
    return mapped.some((permission) => actor.permissions?.includes(permission) === true)
  }
  return actor.role === ruleRole || actor.permissions?.includes(ruleRole) === true
}

/**
 * 默认放行：没有权限层 / 空规则时保持旧行为。
 * 有规则时，必须命中 role + resource + action 三者之一。
 */
export function canAccessBlueprintResource(
  layer: BlueprintPermissionsLayer | null | undefined,
  actor: BlueprintAccessActor | null | undefined,
  resource: string,
  action: BlueprintPermissionAction,
): boolean {
  if (!layer || !Array.isArray(layer.rules) || layer.rules.length === 0) return true
  const actual = actor ?? {}
  return layer.rules.some((rule) => {
    if (!actorHasBlueprintRole(layer, rule.role, actual)) return false
    if (!rule.resources.includes('*') && !rule.resources.includes(resource)) return false
    return !rule.actions || rule.actions.includes(action)
  })
}

export function canAccessBlueprintPage(
  layer: BlueprintPermissionsLayer | null | undefined,
  actor: BlueprintAccessActor | null | undefined,
  entity: string,
): boolean {
  return canAccessBlueprintResource(layer, actor, entity, 'read')
}
