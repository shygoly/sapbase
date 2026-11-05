import { normalizeDefinitionShape } from './definition-to-blueprint'
import { unwrapGenerated } from './definition-schema'

export type DefinitionPatchScope = 'object' | 'state' | 'permission' | 'page' | 'menu'
export type DefinitionPatchOperation = 'add' | 'update' | 'remove' | 'reorder' | 'replace'
export type DefinitionPatchSecurityLevel = 'L1' | 'L2' | 'L3'

export interface DefinitionPatch {
  patchId?: string
  timestamp?: string
  description?: string
  scope: DefinitionPatchScope
  operation: DefinitionPatchOperation
  target: { identifier: string; path?: string }
  payload: {
    field?: Record<string, unknown>
    state?: Record<string, unknown>
    transition?: Record<string, unknown>
    page?: Record<string, unknown>
    permission?: Record<string, unknown>
    menu?: Record<string, unknown>
  }
  securityLevel?: DefinitionPatchSecurityLevel
}

export type DefinitionPatchErrorReason =
  | 'unsupported-scope'
  | 'unsupported-operation'
  | 'unsupported-payload'
  | 'invalid-target'
  | 'entity-not-found'
  | 'field-not-found'
  | 'field-exists'
  | 'state-not-found'
  | 'state-exists'
  | 'l3-blocked'
  | 'confirmation-required'

export class DefinitionPatchError extends Error {
  constructor(
    message: string,
    readonly reason: DefinitionPatchErrorReason,
  ) {
    super(message)
    this.name = 'DefinitionPatchError'
  }
}

export interface ApplyDefinitionPatchOptions {
  /** L2 patch 必须显式确认；L3 永远拒绝。 */
  confirmed?: boolean
}

export interface ApplyDefinitionPatchResult {
  definition: Record<string, unknown>
  changed: string[]
}

const SUPPORTED_SCOPES = new Set(['object', 'state', 'page', 'permission', 'menu'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function stepValue(definition: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = unwrapGenerated(definition[key])
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

function ensureObjectModel(definition: Record<string, unknown>): Record<string, unknown> {
  const objectModel = stepValue(definition, 'objectModel', 'step1_objectModel')
  if (!isRecord(objectModel) || !Array.isArray(objectModel.entities)) {
    throw new DefinitionPatchError('定义缺少 objectModel.entities', 'invalid-target')
  }
  return objectModel
}

function ensureStateFlow(definition: Record<string, unknown>): Record<string, unknown> {
  const stateFlow = stepValue(definition, 'stateFlow', 'step3_stateFlow')
  if (!isRecord(stateFlow)) {
    throw new DefinitionPatchError('定义缺少 stateFlow', 'invalid-target')
  }
  if (!Array.isArray(stateFlow.states)) stateFlow.states = []
  if (!Array.isArray(stateFlow.transitions)) stateFlow.transitions = []
  return stateFlow
}

function fieldNameOf(patch: DefinitionPatch): string {
  const fromPath = patch.target.path?.startsWith('fields.')
    ? patch.target.path.slice('fields.'.length)
    : ''
  const fromPayload = typeof patch.payload.field?.name === 'string' ? patch.payload.field.name : ''
  const name = fromPayload || fromPath
  if (!name) {
    throw new DefinitionPatchError('object patch 必须提供 payload.field.name 或 target.path=fields.<name>', 'invalid-target')
  }
  return name
}

function applyObjectPatch(
  definition: Record<string, unknown>,
  patch: DefinitionPatch,
  changed: string[],
): void {
  const hasFieldPayload = Boolean(patch.payload.field && isRecord(patch.payload.field))
  const removeByPath =
    patch.operation === 'remove' && Boolean(patch.target.path?.startsWith('fields.'))
  if (!hasFieldPayload && !removeByPath) {
    throw new DefinitionPatchError(
      'object patch 目前只支持 payload.field（字段增删改）',
      'unsupported-payload',
    )
  }
  const objectModel = ensureObjectModel(definition)
  const entities = objectModel.entities as Array<Record<string, unknown>>
  const entity = entities.find((item) => item.identifier === patch.target.identifier)
  if (!entity) {
    throw new DefinitionPatchError(
      `实体不存在：${patch.target.identifier}`,
      'entity-not-found',
    )
  }
  if (!Array.isArray(entity.fields)) entity.fields = []
  const fields = entity.fields as Array<Record<string, unknown>>
  const name = fieldNameOf(patch)

  if (patch.operation === 'add') {
    if (fields.some((field) => field.name === name)) {
      throw new DefinitionPatchError(`字段已存在：${patch.target.identifier}.${name}`, 'field-exists')
    }
    fields.push({ ...(patch.payload.field ?? {}), name })
    changed.push(`add field ${patch.target.identifier}.${name}`)
    return
  }
  const index = fields.findIndex((field) => field.name === name)
  if (index === -1) {
    throw new DefinitionPatchError(`字段不存在：${patch.target.identifier}.${name}`, 'field-not-found')
  }
  if (patch.operation === 'remove') {
    fields.splice(index, 1)
    changed.push(`remove field ${patch.target.identifier}.${name}`)
    return
  }
  if (patch.operation === 'update') {
    fields[index] = { ...fields[index], ...(patch.payload.field ?? {}), name }
    changed.push(`update field ${patch.target.identifier}.${name}`)
    return
  }
  throw new DefinitionPatchError(`object patch 不支持 operation=${patch.operation}`, 'unsupported-operation')
}

function applyStatePatch(
  definition: Record<string, unknown>,
  patch: DefinitionPatch,
  changed: string[],
): void {
  const stateFlow = ensureStateFlow(definition)
  const states = stateFlow.states as Array<Record<string, unknown>>
  const transitions = stateFlow.transitions as Array<Record<string, unknown>>

  if (patch.payload.transition && isRecord(patch.payload.transition)) {
    if (patch.operation !== 'add') {
      throw new DefinitionPatchError('transition 只支持 add', 'unsupported-operation')
    }
    const from = patch.payload.transition.from
    const to = patch.payload.transition.to
    if (typeof from !== 'string' || typeof to !== 'string') {
      throw new DefinitionPatchError('transition 必须包含 from/to', 'invalid-target')
    }
    transitions.push({ ...patch.payload.transition, from, to })
    changed.push(`add transition ${from}->${to}`)
    return
  }

  const state = patch.payload.state
  if (!isRecord(state) || typeof state.name !== 'string' || state.name.length === 0) {
    throw new DefinitionPatchError('state patch 必须提供 payload.state.name', 'invalid-target')
  }
  const index = states.findIndex((item) => item.name === state.name)
  if (patch.operation === 'add') {
    if (index !== -1) {
      throw new DefinitionPatchError(`状态已存在：${state.name}`, 'state-exists')
    }
    const { transitions: outgoing, ...rest } = state
    states.push({ ...rest, name: state.name })
    if (Array.isArray(outgoing)) {
      for (const to of outgoing) {
        if (typeof to === 'string' && to.length > 0) {
          transitions.push({ from: state.name, to })
        }
      }
    }
    changed.push(`add state ${state.name}`)
    return
  }
  if (index === -1) {
    throw new DefinitionPatchError(`状态不存在：${state.name}`, 'state-not-found')
  }
  if (patch.operation === 'remove') {
    states.splice(index, 1)
    for (let i = transitions.length - 1; i >= 0; i -= 1) {
      if (transitions[i].from === state.name || transitions[i].to === state.name) {
        transitions.splice(i, 1)
      }
    }
    changed.push(`remove state ${state.name}`)
    return
  }
  if (patch.operation === 'update') {
    states[index] = { ...states[index], ...state, name: state.name }
    if (Array.isArray(state.transitions)) {
      for (let i = transitions.length - 1; i >= 0; i -= 1) {
        if (transitions[i].from === state.name) transitions.splice(i, 1)
      }
      for (const to of state.transitions) {
        if (typeof to === 'string' && to.length > 0) {
          transitions.push({ from: state.name, to })
        }
      }
    }
    changed.push(`update state ${state.name}`)
    return
  }
  throw new DefinitionPatchError(`state patch 不支持 operation=${patch.operation}`, 'unsupported-operation')
}

function ensurePages(definition: Record<string, unknown>): Record<string, unknown> {
  const current = stepValue(definition, 'pages', 'step4_pages')
  const pages = isRecord(current) && Array.isArray(current.pages) ? current : { pages: [] }
  if (!Array.isArray(pages.menus)) pages.menus = []
  definition.pages = pages
  return pages
}

function pageIdentifierOf(patch: DefinitionPatch): string {
  const payload = patch.payload.page
  const fromPayload = isRecord(payload) && typeof payload.identifier === 'string' ? payload.identifier : ''
  return fromPayload || patch.target.identifier
}

function applyPagePatch(
  definition: Record<string, unknown>,
  patch: DefinitionPatch,
  changed: string[],
): void {
  if (!isRecord(patch.payload.page)) {
    throw new DefinitionPatchError('page patch 必须提供 payload.page', 'unsupported-payload')
  }
  const pages = ensurePages(definition)
  const list = pages.pages as Array<Record<string, unknown>>
  const identifier = pageIdentifierOf(patch)
  if (!identifier) {
    throw new DefinitionPatchError('page patch 必须提供 identifier', 'invalid-target')
  }
  const index = list.findIndex((item) => item.identifier === identifier)
  if (patch.operation === 'add') {
    if (index !== -1) {
      throw new DefinitionPatchError(`页面已存在：${identifier}`, 'invalid-target')
    }
    list.push({ ...patch.payload.page, identifier })
    changed.push(`add page ${identifier}`)
    return
  }
  if (index === -1) {
    throw new DefinitionPatchError(`页面不存在：${identifier}`, 'invalid-target')
  }
  if (patch.operation === 'remove') {
    list.splice(index, 1)
    changed.push(`remove page ${identifier}`)
    return
  }
  if (patch.operation === 'update') {
    list[index] = { ...list[index], ...patch.payload.page, identifier }
    changed.push(`update page ${identifier}`)
    return
  }
  throw new DefinitionPatchError(`page patch 不支持 operation=${patch.operation}`, 'unsupported-operation')
}

function applyPermissionPatch(
  definition: Record<string, unknown>,
  patch: DefinitionPatch,
  changed: string[],
): void {
  if (!isRecord(patch.payload.permission)) {
    throw new DefinitionPatchError(
      'permission patch 必须提供 payload.permission',
      'unsupported-payload',
    )
  }
  const current = stepValue(definition, 'permissions', 'step5_permissions')
  const holder = isRecord(current) && Array.isArray(current.rules) ? current : { rules: [] }
  definition.permissions = holder
  const rules = holder.rules as Array<Record<string, unknown>>
  const permission = patch.payload.permission
  const role =
    typeof permission.role === 'string' && permission.role.length > 0
      ? permission.role
      : patch.target.identifier
  if (!role) {
    throw new DefinitionPatchError('permission patch 必须提供 role', 'invalid-target')
  }
  const index = rules.findIndex((item) => item.role === role)
  if (patch.operation === 'add') {
    if (index !== -1) {
      throw new DefinitionPatchError(`权限角色已存在：${role}`, 'invalid-target')
    }
    rules.push({ ...permission, role })
    changed.push(`add permission ${role}`)
    return
  }
  if (index === -1) {
    throw new DefinitionPatchError(`权限角色不存在：${role}`, 'invalid-target')
  }
  if (patch.operation === 'remove') {
    rules.splice(index, 1)
    changed.push(`remove permission ${role}`)
    return
  }
  if (patch.operation === 'update') {
    rules[index] = { ...rules[index], ...permission, role }
    changed.push(`update permission ${role}`)
    return
  }
  throw new DefinitionPatchError(
    `permission patch 不支持 operation=${patch.operation}`,
    'unsupported-operation',
  )
}

function applyMenuPatch(
  definition: Record<string, unknown>,
  patch: DefinitionPatch,
  changed: string[],
): void {
  if (!isRecord(patch.payload.menu)) {
    throw new DefinitionPatchError('menu patch 必须提供 payload.menu', 'unsupported-payload')
  }
  const pages = ensurePages(definition)
  if ((pages.pages as unknown[]).length === 0) {
    throw new DefinitionPatchError('菜单需要至少一个页面（ui.json 要求 pages 非空）', 'invalid-target')
  }
  const menus = pages.menus as Array<Record<string, unknown>>
  const identifier =
    typeof patch.payload.menu.identifier === 'string'
      ? patch.payload.menu.identifier
      : patch.target.identifier
  if (!identifier) {
    throw new DefinitionPatchError('menu patch 必须提供 identifier', 'invalid-target')
  }
  const index = menus.findIndex((item) => item.identifier === identifier)
  if (patch.operation === 'add') {
    if (index !== -1) {
      throw new DefinitionPatchError(`菜单已存在：${identifier}`, 'invalid-target')
    }
    menus.push({ ...patch.payload.menu, identifier })
    changed.push(`add menu ${identifier}`)
    return
  }
  if (index === -1) {
    throw new DefinitionPatchError(`菜单不存在：${identifier}`, 'invalid-target')
  }
  if (patch.operation === 'remove') {
    menus.splice(index, 1)
    changed.push(`remove menu ${identifier}`)
    return
  }
  if (patch.operation === 'update') {
    menus[index] = { ...menus[index], ...patch.payload.menu, identifier }
    changed.push(`update menu ${identifier}`)
    return
  }
  throw new DefinitionPatchError(`menu patch 不支持 operation=${patch.operation}`, 'unsupported-operation')
}

/**
 * 应用服务端可表达的 Patch：
 *   · object     → 字段 add/update/remove
 *   · state      → 状态/迁移 add/update/remove
 *   · page       → UI 页面 add/update/remove
 *   · permission → 角色规则 add/update/remove
 *   · menu       → 菜单 add/update/remove
 */
export function applyDefinitionPatch(
  definition: Record<string, unknown>,
  patch: DefinitionPatch,
  options: ApplyDefinitionPatchOptions = {},
): ApplyDefinitionPatchResult {
  if (patch.securityLevel === 'L3') {
    throw new DefinitionPatchError('L3 patch 被禁止：操作过于危险', 'l3-blocked')
  }
  if (patch.securityLevel === 'L2' && options.confirmed !== true) {
    throw new DefinitionPatchError('L2 patch 需要 confirmed: true', 'confirmation-required')
  }
  if (!SUPPORTED_SCOPES.has(patch.scope)) {
    throw new DefinitionPatchError(
      `服务端 Blueprint 不支持 scope=${patch.scope}（只支持 object / state）`,
      'unsupported-scope',
    )
  }
  if (patch.operation === 'reorder' || patch.operation === 'replace') {
    throw new DefinitionPatchError(
      `服务端 Blueprint 不支持 operation=${patch.operation}`,
      'unsupported-operation',
    )
  }

  const copy = JSON.parse(JSON.stringify(definition)) as Record<string, unknown>
  const normalized = normalizeDefinitionShape(copy)
  const changed: string[] = []
  switch (patch.scope) {
    case 'object':
      applyObjectPatch(normalized, patch, changed)
      break
    case 'state':
      applyStatePatch(normalized, patch, changed)
      break
    case 'page':
      applyPagePatch(normalized, patch, changed)
      break
    case 'permission':
      applyPermissionPatch(normalized, patch, changed)
      break
    case 'menu':
      applyMenuPatch(normalized, patch, changed)
      break
  }
  return { definition: normalized, changed }
}

/** 1.0.0 → 1.0.1；非法版本直接拒绝，避免包 id 与版本脱节。 */
export function bumpPatchVersion(version: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) {
    throw new DefinitionPatchError(`模块版本不是语义化版本：${version}`, 'invalid-target')
  }
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`
}
