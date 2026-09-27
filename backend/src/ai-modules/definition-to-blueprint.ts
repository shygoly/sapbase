/**
 * AI 六步 mergedDefinition → 蓝图分层（纯函数）。
 * 只映射源里真实存在的键；缺 rules / experience 就缺层，不编占位。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Validator } from 'jsonschema'
import type { BlueprintIrAction } from '@speckit/shared-schemas'
import { loadSchema } from '../common/protocol/schema-loader'
import { detectConflicts } from '../blueprint/compiler'
import type { BlueprintMeta } from '../blueprint/packager'
import { BLUEPRINT_META_FILE } from '../blueprint/packager'
import { normalizeStep3StateFlow } from './step3-normalizer'

const ENTITY_NAME = /^[A-Z][A-Za-z0-9]*$/
const FIELD_NAME = /^[a-z][A-Za-z0-9]*$/
const STATE_NAME = /^[a-z][A-Za-z0-9]*$/
const FLOW_ID = /^[A-Z][A-Za-z0-9]*$/
const ATOMIC_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

const FIELD_TYPE_MAP: Record<string, string> = {
  string: 'text',
  text: 'text',
  number: 'number',
  int: 'number',
  integer: 'number',
  decimal: 'decimal',
  money: 'decimal',
  boolean: 'boolean',
  bool: 'boolean',
  date: 'date',
  datetime: 'datetime',
  timestamp: 'datetime',
  i32: 'i32',
  reference: 'reference',
  enum: 'enum',
}

const RELATION_TYPE_MAP: Record<string, 'belongsTo' | 'hasOne' | 'hasMany' | 'manyToMany'> = {
  'one-to-one': 'hasOne',
  hasone: 'hasOne',
  'one-to-many': 'hasMany',
  hasmany: 'hasMany',
  'many-to-many': 'manyToMany',
  manytomany: 'manyToMany',
  'many-to-one': 'belongsTo',
  belongsto: 'belongsTo',
}

export class DefinitionToBlueprintError extends Error {
  constructor(
    message: string,
    readonly reason:
      | 'invalid-input'
      | 'invalid-entity-name'
      | 'invalid-field-name'
      | 'invalid-state'
      | 'schema-invalid'
      | 'conflict',
  ) {
    super(message)
    this.name = 'DefinitionToBlueprintError'
  }
}

export interface BlueprintSemanticEntity {
  name: string
  fields: Array<{
    name: string
    type: string
    required?: boolean
    reference?: string
    values?: string[]
  }>
  relations?: Array<{ name: string; type: string; target: string }>
  states: Array<{ name: string; initial?: boolean; final?: boolean }>
  transitions?: Array<{ from: string; to: string; rule?: string }>
}

export interface BlueprintLayers {
  semantic: { entities: BlueprintSemanticEntity[] }
  flows: {
    flows: Array<{
      id: string
      entity: string
      steps: Array<{
        id: string
        on: string
        next?: string[]
        actions: BlueprintIrAction[]
      }>
    }>
  }
  rules?: {
    rules: 'blueprint-rules/v1'
    validation: unknown[]
    approval: unknown[]
    accounting: unknown[]
  }
  experience?: {
    experience: 'blueprint-experience/v1'
    priority: unknown[]
    confirm: unknown[]
    automate: unknown[]
    surfaces: unknown[]
  }
}

function fail(
  message: string,
  reason: DefinitionToBlueprintError['reason'] = 'invalid-input',
): never {
  throw new DefinitionToBlueprintError(message, reason)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** 六步产物可能包在 { generated } 里。 */
function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value
  if ('generated' in value) return unwrap(value.generated)
  return value
}

function toPascalCase(raw: string): string | null {
  const parts = raw.split(/[-_\s]+/).filter(Boolean)
  if (parts.length === 0) return null
  if (!parts.every((part) => /^[A-Za-z][A-Za-z0-9]*$/.test(part))) return null
  return parts.map((part) => part[0].toUpperCase() + part.slice(1)).join('')
}

function toCamelCase(raw: string): string | null {
  const pascal = toPascalCase(raw)
  if (!pascal) return null
  return pascal[0].toLowerCase() + pascal.slice(1)
}

function requireEntityName(raw: unknown, where: string): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    fail(`${where} 缺少实体名`, 'invalid-entity-name')
  }
  const mapped = ENTITY_NAME.test(raw) ? raw : toPascalCase(raw)
  if (!mapped || !ENTITY_NAME.test(mapped)) {
    fail(`非法实体名：${raw}（须匹配 ^[A-Z][A-Za-z0-9]*$）`, 'invalid-entity-name')
  }
  return mapped
}

function requireFieldName(raw: unknown, where: string): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    fail(`${where} 缺少字段名`, 'invalid-field-name')
  }
  const mapped = FIELD_NAME.test(raw) ? raw : toCamelCase(raw)
  if (!mapped || !FIELD_NAME.test(mapped)) {
    fail(`非法字段名：${raw}（须匹配 ^[a-z][A-Za-z0-9]*$）`, 'invalid-field-name')
  }
  return mapped
}

function requireStateName(raw: unknown, where: string): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    fail(`${where} 缺少状态名`, 'invalid-state')
  }
  const mapped = STATE_NAME.test(raw) ? raw : toCamelCase(raw)
  if (!mapped || !STATE_NAME.test(mapped)) {
    fail(`非法状态名：${raw}（须匹配 ^[a-z][A-Za-z0-9]*$）`, 'invalid-state')
  }
  return mapped
}

function mapFieldType(raw: unknown, fieldName: string): string {
  if (typeof raw !== 'string') fail(`字段 ${fieldName} 缺少 type`)
  const mapped = FIELD_TYPE_MAP[raw.toLowerCase()]
  if (!mapped) fail(`字段 ${fieldName} 的类型 ${raw} 无法映射到 semantic`)
  return mapped
}

function stepOf(merged: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (merged[key] !== undefined && merged[key] !== null) return unwrap(merged[key])
  }
  return undefined
}

function readEntities(objectModel: unknown): unknown[] {
  const unwrapped = unwrap(objectModel)
  if (!isRecord(unwrapped)) fail('mergedDefinition.objectModel 必须是对象')
  const entities = unwrapped.entities
  if (!Array.isArray(entities) || entities.length === 0) {
    fail('mergedDefinition.objectModel.entities 必须是非空数组')
  }
  return entities
}

function mapFields(raw: unknown, entityName: string): BlueprintSemanticEntity['fields'] {
  if (!Array.isArray(raw) || raw.length === 0) {
    fail(`实体 ${entityName} 必须至少有一个字段`)
  }
  return raw.map((item, index) => {
    if (!isRecord(item)) fail(`实体 ${entityName} 的 fields[${index}] 必须是对象`)
    const name = requireFieldName(item.name, `${entityName}.fields[${index}]`)
    const type = mapFieldType(item.type, `${entityName}.${name}`)
    const field: BlueprintSemanticEntity['fields'][number] = { name, type }
    if (item.required === true) field.required = true
    if (type === 'reference') {
      const target = item.reference ?? item.target
      field.reference = requireEntityName(target, `${entityName}.${name}.reference`)
    }
    if (type === 'enum') {
      if (!Array.isArray(item.values) || item.values.length === 0) {
        fail(`实体 ${entityName} 的枚举字段 ${name} 缺少 values`)
      }
      field.values = item.values.map(String)
    }
    return field
  })
}

function mapMachine(raw: unknown, entityName: string): {
  states: BlueprintSemanticEntity['states']
  transitions: NonNullable<BlueprintSemanticEntity['transitions']>
  actions: string[]
} {
  const normalized = normalizeStep3StateFlow(raw)
  if (!normalized) fail(`实体 ${entityName} 的状态机无法规范化`, 'invalid-state')
  const states = normalized.states.map((state) => ({
    name: requireStateName(state.name, `${entityName}.states`),
    ...(state.initial ? { initial: true } : {}),
    ...(state.final ? { final: true } : {}),
  }))
  const transitions = normalized.transitions.map((transition) => ({
    from: requireStateName(transition.from, `${entityName}.transitions.from`),
    to: requireStateName(transition.to, `${entityName}.transitions.to`),
  }))
  const actions = normalized.transitions
    .map((transition) => transition.action)
    .filter((action): action is string => typeof action === 'string' && ATOMIC_NAME.test(action))
  return { states, transitions, actions }
}

function mapRelationships(
  raw: unknown,
  entityNames: Set<string>,
): Map<string, NonNullable<BlueprintSemanticEntity['relations']>> {
  const relations = new Map<string, NonNullable<BlueprintSemanticEntity['relations']>>()
  const unwrapped = unwrap(raw)
  if (unwrapped === undefined || unwrapped === null) return relations
  const list = Array.isArray(unwrapped)
    ? unwrapped
    : isRecord(unwrapped) && Array.isArray(unwrapped.relationships)
      ? unwrapped.relationships
      : null
  if (list === null) fail('mergedDefinition.relationships 必须是数组或 { relationships }')
  for (const item of list) {
    if (!isRecord(item)) continue
    const source = requireEntityName(item.source ?? item.from, 'relationship.source')
    const target = requireEntityName(item.target ?? item.to, 'relationship.target')
    if (!entityNames.has(source) || !entityNames.has(target)) {
      fail(`关系 ${source}→${target} 引用了未声明的实体`)
    }
    const mappedType =
      RELATION_TYPE_MAP[String(item.type ?? 'one-to-many').toLowerCase()] ?? 'hasMany'
    const name =
      typeof item.name === 'string' && FIELD_NAME.test(item.name)
        ? item.name
        : toCamelCase(target) ?? fail(`无法从 ${target} 推导关系名`, 'invalid-field-name')
    const bucket = relations.get(source) ?? []
    bucket.push({ name, type: mappedType, target })
    relations.set(source, bucket)
  }
  return relations
}

function pickMachineForEntity(
  stateFlow: unknown,
  entityName: string,
  index: number,
): unknown {
  const unwrapped = unwrap(stateFlow)
  if (!isRecord(unwrapped)) return unwrapped
  if (Array.isArray(unwrapped.entities)) {
    const match = unwrapped.entities.find(
      (item) =>
        isRecord(item) &&
        (item.identifier === entityName || item.name === entityName),
    )
    if (match) return match
    if (unwrapped.entities.length === 1) return unwrapped.entities[0]
  }
  if (isRecord(unwrapped[entityName])) return unwrapped[entityName]
  if (Array.isArray(unwrapped.states)) return unwrapped
  if (index === 0) return unwrapped
  return undefined
}

function deriveFlows(
  entities: BlueprintSemanticEntity[],
  actionsByEntity: Map<string, string[]>,
): BlueprintLayers['flows'] {
  const flows: BlueprintLayers['flows']['flows'] = []
  for (const entity of entities) {
    const atomics = actionsByEntity.get(entity.name) ?? []
    if (atomics.length === 0) continue
    const atomic = atomics[0]
    const outgoing = new Map<string, string[]>()
    for (const transition of entity.transitions ?? []) {
      const next = outgoing.get(transition.from) ?? []
      if (!next.includes(transition.to)) next.push(transition.to)
      outgoing.set(transition.from, next)
    }
    const steps = entity.states.map((state) => {
      const next = (outgoing.get(state.name) ?? []).filter((name) =>
        entity.states.some((candidate) => candidate.name === name),
      )
      return {
        id: state.name,
        on: state.name,
        ...(next.length > 0 ? { next } : {}),
        actions: [{ kind: 'check' as const, atomic }],
      }
    })
    const flowId = `${entity.name}Flow`
    if (!FLOW_ID.test(flowId)) fail(`无法为 ${entity.name} 生成合法 flow id`)
    flows.push({ id: flowId, entity: entity.name, steps })
  }
  return { flows }
}

function readBlueprintRules(raw: unknown): BlueprintLayers['rules'] | undefined {
  const unwrapped = unwrap(raw)
  if (!isRecord(unwrapped)) return undefined
  if (unwrapped.rules !== 'blueprint-rules/v1') return undefined
  if (!Array.isArray(unwrapped.validation) || !Array.isArray(unwrapped.approval) || !Array.isArray(unwrapped.accounting)) {
    return undefined
  }
  return {
    rules: 'blueprint-rules/v1',
    validation: unwrapped.validation,
    approval: unwrapped.approval,
    accounting: unwrapped.accounting,
  }
}

function readBlueprintExperience(raw: unknown): BlueprintLayers['experience'] | undefined {
  const unwrapped = unwrap(raw)
  if (!isRecord(unwrapped)) return undefined
  if (unwrapped.experience !== 'blueprint-experience/v1') return undefined
  if (
    !Array.isArray(unwrapped.priority) ||
    !Array.isArray(unwrapped.confirm) ||
    !Array.isArray(unwrapped.automate) ||
    !Array.isArray(unwrapped.surfaces)
  ) {
    return undefined
  }
  return {
    experience: 'blueprint-experience/v1',
    priority: unwrapped.priority,
    confirm: unwrapped.confirm,
    automate: unwrapped.automate,
    surfaces: unwrapped.surfaces,
  }
}

function assertLayerSchema(file: string, value: unknown, schemaFile: string): void {
  const result = new Validator().validate(value, loadSchema(schemaFile))
  if (!result.valid) {
    fail(
      `${file} 未通过协议校验：${result.errors.map((error) => error.message).join('; ')}`,
      'schema-invalid',
    )
  }
}

function inferAtomics(flows: BlueprintLayers['flows']): Array<{ atomic: string; version: string }> {
  const names = new Set<string>()
  for (const flow of flows.flows) {
    for (const step of flow.steps) {
      for (const action of step.actions) {
        if (action.kind === 'check' && action.atomic) {
          names.add(action.atomic.split('@')[0])
        }
      }
    }
  }
  return [...names].map((atomic) => ({ atomic, version: '^1.0.0' }))
}

/**
 * 纯函数：mergedDefinition → 五层。缺 rules / experience 则为 undefined。
 */
export function definitionToBlueprint(mergedDefinition: Record<string, unknown>): BlueprintLayers {
  if (!isRecord(mergedDefinition)) fail('mergedDefinition 必须是对象')

  const objectModel = stepOf(mergedDefinition, 'objectModel', 'step1_objectModel')
  const relationships = stepOf(mergedDefinition, 'relationships', 'step2_relationships')
  const stateFlow = stepOf(mergedDefinition, 'stateFlow', 'step3_stateFlow')
  if (objectModel === undefined) fail('mergedDefinition 缺少 objectModel')
  if (stateFlow === undefined) {
    fail('mergedDefinition 缺少 stateFlow（每个实体必须有状态机，不许编造）')
  }

  const rawEntities = readEntities(objectModel)
  const names = new Set<string>()
  const actionsByEntity = new Map<string, string[]>()
  const entities: BlueprintSemanticEntity[] = rawEntities.map((item, index) => {
    if (!isRecord(item)) fail(`objectModel.entities[${index}] 必须是对象`)
    const name = requireEntityName(item.identifier ?? item.name, `entities[${index}]`)
    if (names.has(name)) fail(`重复实体：${name}`)
    names.add(name)
    const machineRaw = isRecord(item.states) || Array.isArray(item.states)
      ? item
      : pickMachineForEntity(stateFlow, name, index)
    if (machineRaw === undefined) {
      fail(`实体 ${name} 没有状态机（不许编造默认态）`, 'invalid-state')
    }
    const machine = mapMachine(machineRaw, name)
    actionsByEntity.set(name, machine.actions)
    return {
      name,
      fields: mapFields(item.fields, name),
      states: machine.states,
      transitions: machine.transitions,
    }
  })

  const relationMap = mapRelationships(relationships, names)
  for (const entity of entities) {
    const extra = relationMap.get(entity.name)
    if (extra && extra.length > 0) entity.relations = extra
  }

  const explicitFlows = unwrap(mergedDefinition.flows)
  const flows =
    isRecord(explicitFlows) && Array.isArray(explicitFlows.flows)
      ? (explicitFlows as BlueprintLayers['flows'])
      : deriveFlows(entities, actionsByEntity)

  const rules = readBlueprintRules(mergedDefinition.rules)
  const experience = readBlueprintExperience(mergedDefinition.experience)

  const layers: BlueprintLayers = { semantic: { entities }, flows }
  if (rules) layers.rules = rules
  if (experience) layers.experience = experience

  assertLayerSchema('semantic.json', layers.semantic, 'blueprint-semantic.schema.json')
  assertLayerSchema('flows.json', layers.flows, 'blueprint-flows.schema.json')
  if (layers.rules) assertLayerSchema('rules.json', layers.rules, 'blueprint-rules.schema.json')
  if (layers.experience) {
    assertLayerSchema('experience.json', layers.experience, 'blueprint-experience.schema.json')
  }

  const conflicts = detectConflicts(layers.semantic, layers.flows, inferAtomics(layers.flows), {
    rules: layers.rules as never,
    experience: layers.experience as never,
  })
  if (conflicts.length > 0) {
    fail(`转换结果过不了编译期判据：${conflicts.join('; ')}`, 'conflict')
  }
  return layers
}

function writeJson(dir: string, file: string, value: unknown): void {
  writeFileSync(join(dir, file), `${JSON.stringify(value, null, 2)}\n`)
}

/**
 * 把转换器产物写成蓝图目录。缺层就不写该文件。
 * 之后走既有 packBlueprint / compileBlueprint / stampCompiled / signPackage / deliver。
 */
export function writeBlueprintDir(
  dir: string,
  layers: BlueprintLayers,
  meta: BlueprintMeta,
): void {
  mkdirSync(dir, { recursive: true })
  const dependencies = [
    ...(meta.dependencies ?? []),
    ...inferAtomics(layers.flows).filter(
      (item) => !(meta.dependencies ?? []).some((dep) => 'atomic' in dep && dep.atomic === item.atomic),
    ),
  ]
  writeJson(dir, BLUEPRINT_META_FILE, { ...meta, dependencies })
  writeJson(dir, 'semantic.json', layers.semantic)
  writeJson(dir, 'flows.json', layers.flows)
  if (layers.rules) writeJson(dir, 'rules.json', layers.rules)
  if (layers.experience) writeJson(dir, 'experience.json', layers.experience)
}
