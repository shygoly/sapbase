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

const SUPPORTED_SCOPES = new Set(['object', 'state'])

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

/**
 * 只应用 Blueprint 能表达的 Patch：
 *   · object → 字段 add/update/remove
 *   · state  → 状态/迁移 add/update/remove
 *
 * page/permission/menu 没有 Blueprint 语义，明确拒绝而不是静默忽略。
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
  if (patch.scope === 'object') applyObjectPatch(normalized, patch, changed)
  else applyStatePatch(normalized, patch, changed)
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
