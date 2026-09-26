import { createHash } from 'node:crypto'
import type {
  BlueprintCompileResult,
  BlueprintIr,
  BlueprintIrAction,
  BlueprintIrEvent,
  BlueprintIrLayerDigest,
} from '@speckit/shared-schemas'
import { Validator, type IJSONSchemaValidationError } from 'jsonschema'
import { loadSchema } from '../common/protocol/schema-loader'
import { BLUEPRINT_MANIFEST_FILE, type UnpackedBlueprint } from './packager'
import { validateBlueprintIr } from './blueprint-validator'
import { type AtomicRegistryService } from '../atomic-registry/atomic-registry.service'
import { canonicalizeJson } from './canonical-json'
import { parseComputedExpression, parseRestrictedExpression } from './rules-expression'

/** v1 有 Schema 覆盖的包内文件。**未列出的文件一律拒绝编译**（"缺 Schema 就不跳过"）。 */
const FILE_SCHEMAS: Record<string, string> = {
  'semantic.json': 'blueprint-semantic.schema.json',
  'flows.json': 'blueprint-flows.schema.json',
  'rules.json': 'blueprint-rules.schema.json',
  'experience.json': 'blueprint-experience.schema.json',
  'license.json': 'blueprint-license.schema.json',
}

/**
 * 审批步骤的平台已知角色。编译必须确定性，所以对照静态目录而不是查库。
 * 要加角色，先改 docs/protocols/blueprint-delivery.md §2.3，再改这里（一份判定）。
 */
export const PLATFORM_APPROVAL_ROLES = new Set([
  'owner',
  'admin',
  'member',
  'gm',
  'finance-manager',
  'purchasing-manager',
  // add-minimal-autoparts-template：加法式扩充，未知角色仍拒
  'sales-manager',
])

export type CompileErrorReason =
  | 'uncovered-file'
  | 'schema-invalid'
  | 'dependency-unresolved'
  | 'conflict'

export class CompileError extends Error {
  constructor(
    message: string,
    readonly reason: CompileErrorReason,
    /** 结构化冲突明细（便于调用方逐条展示）。 */
    readonly conflicts: string[] = [],
  ) {
    super(message)
    this.name = 'CompileError'
  }
}

interface SemanticComputed {
  expr: string
  dependsOn: string[]
}

interface SemanticUomPack {
  name: string
  factor: number | { numerator: number; denominator: number }
}

interface SemanticFieldPermissions {
  read?: string
  write?: string
}

interface SemanticField {
  name: string
  type: string
  required?: boolean
  reference?: string
  money?: boolean
  currency?: string
  permissions?: SemanticFieldPermissions
  precision?: number
  scale?: number
  rounding?: string
  unique?: boolean
  values?: string[]
  computed?: SemanticComputed
  uom?: { base: string; packs: SemanticUomPack[] }
  onDelete?: string
  default?: unknown
}

interface SemanticNumbering {
  field: string
  prefix: string
  dateFormat?: string
  width: number
}

interface SemanticEntity {
  name: string
  fields: SemanticField[]
  relations?: Array<{ name: string; type: string; target: string; cardinality?: string }>
  states: Array<{ name: string; initial?: boolean; final?: boolean }>
  transitions?: Array<{ from: string; to: string; rule?: string }>
  children?: string[]
  parent?: { entity: string; field: string }
  numbering?: SemanticNumbering
  rollups?: Array<{ field: string; over: string; of: string; fn: string }>
  ownership?: { field: string; readAllPermission: string }
}

/** 与运行时列 / 载荷保留键冲突的字段名；模板不得声明。 */
const RESERVED_FIELD_NAMES = new Set(['children', 'state', 'version', 'id', 'createdAt', 'updatedAt'])
const NUMBERING_DATE_FORMATS = new Set(['YYYYMMDD', 'YYYYMM', 'YYYY', 'none'])
const ON_DELETE_POLICIES = new Set(['restrict', 'setNull'])
const ISO_CURRENCY = /^[A-Z]{3}$/
const DOTTED_PERMISSION = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/

interface FlowsFile {
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

interface ValidationRule {
  id: string
  entity: string
  field: string
  rule: string
  value?: unknown
  message: string
}

interface ApprovalRule {
  id: string
  entity: string
  when: string
  steps: Array<{ role: string }>
}

interface AccountingEntry {
  account: string
  side: 'debit' | 'credit'
  amount: number | string
}

interface AccountingRule {
  id: string
  on: string
  entries: AccountingEntry[]
}

export interface RulesFile {
  rules: string
  validation: ValidationRule[]
  approval: ApprovalRule[]
  accounting: AccountingRule[]
}

export interface ExperienceFile {
  experience: string
  priority: Array<{ entity: string; fields: string[] }>
  confirm: Array<{ action: string; when: { field: string; op: string; value: unknown } }>
  automate: Array<{ action: string }>
  surfaces: Array<{ id: string; when: { entity: string; state: string } }>
}

export interface DetectConflictsExtras {
  rules?: RulesFile
  experience?: ExperienceFile
}

let validator: Validator | undefined
function getValidator(): Validator {
  if (!validator) validator = new Validator()
  return validator
}

function formatErrors(errors: IJSONSchemaValidationError[]): string[] {
  return errors.map((e) => `${e.property.replace(/^instance\.?/, '') || '(root)'}: ${e.message}`)
}

/**
 * 编译蓝图包。
 *
 * 固定顺序（design.md）：包与清单校验（已在解包时完成）→ 逐文件 Schema →
 * 依赖闭包 → 冲突检测 → IR 生成。任一阶段失败即抛 `CompileError`，不产出可加载结果。
 */
export async function compileBlueprint(
  unpacked: UnpackedBlueprint,
  registry: AtomicRegistryService,
): Promise<BlueprintCompileResult> {
  const { manifest, files } = unpacked

  // ── 1. 逐文件 Schema（未覆盖的文件拒绝，不跳过）────────────────────
  const jsonFiles = new Map<string, unknown>()
  for (const [rel, bytes] of files) {
    if (rel === BLUEPRINT_MANIFEST_FILE) continue
    const schemaFile = FILE_SCHEMAS[rel]
    if (!schemaFile) {
      throw new CompileError(
        `文件 ${rel} 尚未被 v1 协议覆盖（不跳过未知文件）`,
        'uncovered-file',
      )
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(bytes.toString('utf8'))
    } catch (error) {
      throw new CompileError(`${rel} 不是合法 JSON：${(error as Error).message}`, 'schema-invalid')
    }
    const result = getValidator().validate(parsed, loadSchema(schemaFile))
    if (!result.valid) {
      throw new CompileError(
        `${rel} 未通过 Schema 校验：${formatErrors(result.errors).join('; ')}`,
        'schema-invalid',
      )
    }
    jsonFiles.set(rel, parsed)
  }

  const semantic = jsonFiles.get('semantic.json') as { entities: SemanticEntity[] }
  const flows = (jsonFiles.get('flows.json') as FlowsFile | undefined) ?? { flows: [] }
  const rules = jsonFiles.get('rules.json') as RulesFile | undefined
  const experience = jsonFiles.get('experience.json') as ExperienceFile | undefined

  // ── 2. 依赖闭包（原子走注册表解析；不可满足即拒）──────────────────
  const resolvedDependencies: string[] = []
  for (const dependency of manifest.dependencies ?? []) {
    if ('atomic' in dependency) {
      try {
        const resolved = await registry.resolve(dependency.atomic, dependency.version)
        resolvedDependencies.push(`${dependency.atomic}@${resolved.contract.version}`)
      } catch (error) {
        throw new CompileError(
          `原子依赖不可满足：${dependency.atomic}@${dependency.version}（${(error as Error).message}）`,
          'dependency-unresolved',
        )
      }
      continue
    }
    // v1 只解析原子依赖；模块/蓝图依赖只登记（跨包解析属市场与注册表那条线）
    resolvedDependencies.push(
      'module' in dependency
        ? `${dependency.module}@${dependency.version}`
        : `${dependency.blueprint}@${dependency.version}`,
    )
  }

  // ── 3. 冲突检测（只做确定性判据）────────────────────────────────
  const conflicts = detectConflicts(semantic, flows, manifest.dependencies ?? [], {
    rules,
    experience,
  })
  if (conflicts.length > 0) {
    throw new CompileError(`蓝图存在 ${conflicts.length} 处冲突`, 'conflict', conflicts)
  }

  // ── 4. IR ──────────────────────────────────────────────────────
  const ir: BlueprintIr = {
    ir: 'blueprint-ir/v1',
    blueprint: manifest.blueprint,
    version: manifest.version,
    runtime: manifest.runtime,
    entities: semantic.entities.map((entity) => ({
      name: entity.name,
      fieldCount: entity.fields.length,
      states: entity.states.map((state) => state.name),
    })),
    events: buildEvents(flows),
    dependencies: resolvedDependencies,
    semantic: semanticLayerDigest(semantic),
    ...(rules ? { rules: layerDigest(rules) } : {}),
    ...(experience ? { experience: layerDigest(experience) } : {}),
    summary: {
      entities: semantic.entities.length,
      events: flows.flows.reduce((count, flow) => count + flow.steps.length, 0),
      files: Object.keys(manifest.files).length,
    },
  }

  // 自检：不产出连自己的协议都通不过的 IR
  const irCheck = validateBlueprintIr(ir)
  if (!irCheck.valid) {
    throw new CompileError(
      `生成的 IR 未通过协议校验（编译器 bug）：${irCheck.errors.join('; ')}`,
      'conflict',
    )
  }

  const irText = toIrText(ir)
  const irDigest = `sha256:${createHash('sha256').update(irText).digest('hex')}`
  return {
    blueprint: ir.blueprint,
    version: ir.version,
    ir,
    irText,
    irDigest,
  }
}

/** 把 flow 步骤展开成 IR 事件（`Entity.state` → 动作列表）。 */
function buildEvents(flows: FlowsFile): BlueprintIrEvent[] {
  return flows.flows.flatMap((flow) =>
    flow.steps.map((step) => ({
      on: `${flow.entity}.${step.on}`,
      actions: step.actions.map((action) => ({ ...action })),
    })),
  )
}

/**
 * 冲突检测：**只做确定性判据**。
 *
 * 四类：重复定义 / 悬空引用 / flow 成环（v1 规定 flow 是 DAG）/ 状态机合法性。
 * 明确**不判**实体关系图的环 —— 自引用（Employee.manager）与回指关系都是合法建模。
 */
export function detectConflicts(
  semantic: { entities: SemanticEntity[] },
  flows: FlowsFile,
  dependencies: Array<Record<string, string>>,
  extras: DetectConflictsExtras = {},
): string[] {
  const conflicts: string[] = []
  const entityNames = semantic.entities.map((entity) => entity.name)
  conflicts.push(...detectSemanticP0Conflicts(semantic))
  conflicts.push(...detectSemanticP1Conflicts(semantic))

  // 重复定义
  for (const name of duplicates(entityNames)) {
    conflicts.push(`重复定义：实体 ${name} 出现多次`)
  }
  for (const id of duplicates(flows.flows.map((flow) => flow.id))) {
    conflicts.push(`重复定义：流程 ${id} 出现多次`)
  }

  const declaredAtomics = new Set(
    dependencies.filter((d) => 'atomic' in d).map((d) => d.atomic),
  )

  for (const entity of semantic.entities) {
    // 悬空引用：关系目标 / 字段引用 / 状态名字
    for (const relation of entity.relations ?? []) {
      if (!entityNames.includes(relation.target)) {
        conflicts.push(`悬空引用：${entity.name}.${relation.name} 指向不存在的实体 ${relation.target}`)
      }
    }
    for (const field of entity.fields) {
      if (field.type === 'reference' && field.reference && !entityNames.includes(field.reference)) {
        conflicts.push(
          `悬空引用：${entity.name}.${field.name} 指向不存在的实体 ${field.reference}`,
        )
      }
    }

    // 状态机合法性
    const stateNames = entity.states.map((state) => state.name)
    for (const name of duplicates(stateNames)) {
      conflicts.push(`重复定义：${entity.name} 的状态 ${name} 出现多次`)
    }
    const initials = entity.states.filter((state) => state.initial)
    if (initials.length !== 1) {
      conflicts.push(
        `状态机非法：${entity.name} 的初始态必须恰好 1 个，实际 ${initials.length} 个`,
      )
    }
    if (!entity.states.some((state) => state.final)) {
      conflicts.push(`状态机非法：${entity.name} 没有任何终态`)
    }

    const transitions = entity.transitions ?? []
    for (const transition of transitions) {
      for (const side of ['from', 'to'] as const) {
        if (!stateNames.includes(transition[side])) {
          conflicts.push(
            `悬空引用：${entity.name} 的迁移 ${transition.from}→${transition.to} 引用了未声明的状态 ${transition[side]}`,
          )
        }
      }
      if (transition.rule) {
        // 闸只加严：rules.json 已覆盖，但 id 必须能在 validation[] 里解析到；没有该文件也拒
        const validationIds = new Set((extras.rules?.validation ?? []).map((rule) => rule.id))
        if (!validationIds.has(transition.rule)) {
          conflicts.push(
            `悬空引用：${entity.name} 的迁移 ${transition.from}→${transition.to} 引用了不存在的规则 ${transition.rule}`,
          )
        }
      }
    }

    // 不可达状态（从初始态按迁移走不到）
    if (initials.length === 1) {
      const reachable = new Set<string>([initials[0].name])
      let grew = true
      while (grew) {
        grew = false
        for (const transition of transitions) {
          if (reachable.has(transition.from) && !reachable.has(transition.to)) {
            reachable.add(transition.to)
            grew = true
          }
        }
      }
      for (const name of stateNames) {
        if (!reachable.has(name)) {
          conflicts.push(`状态机非法：${entity.name} 的状态 ${name} 从初始态不可达`)
        }
      }
    }
  }

  // 流程：实体存在、步骤 on 必须是该实体的状态、next 指向本流程步骤、原子依赖已声明、DAG
  for (const flow of flows.flows) {
    const entity = semantic.entities.find((candidate) => candidate.name === flow.entity)
    if (!entity) {
      conflicts.push(`悬空引用：流程 ${flow.id} 引用了不存在的实体 ${flow.entity}`)
      continue
    }
    const stateNames = entity.states.map((state) => state.name)
    const stepIds = flow.steps.map((step) => step.id)
    for (const id of duplicates(stepIds)) {
      conflicts.push(`重复定义：流程 ${flow.id} 的步骤 ${id} 出现多次`)
    }
    for (const step of flow.steps) {
      if (!stateNames.includes(step.on)) {
        conflicts.push(
          `悬空引用：流程 ${flow.id} 的步骤 ${step.id} 触发于未声明的状态 ${step.on}`,
        )
      }
      for (const next of step.next ?? []) {
        if (!stepIds.includes(next)) {
          conflicts.push(`悬空引用：流程 ${flow.id} 的步骤 ${step.id} 指向不存在的步骤 ${next}`)
        }
      }
      for (const action of step.actions) {
        if (
          action.kind === 'check' &&
          action.atomic &&
          !declaredAtomics.has(action.atomic.split('@')[0])
        ) {
          conflicts.push(
            `悬空引用：流程 ${flow.id} 的步骤 ${step.id} 调用了未在清单中声明的原子 ${action.atomic}`,
          )
        }
      }
    }

    const cycle = findCycle(flow.steps)
    if (cycle) {
      conflicts.push(`流程成环：${flow.id} 的步骤图存在环 ${cycle.join(' → ')}（v1 要求 flow 是 DAG）`)
    }
  }

  const declaredEvents = buildEvents(flows).map((event) => event.on)
  if (extras.rules) {
    conflicts.push(...detectRuleConflicts(semantic.entities, extras.rules, declaredEvents))
  }
  if (extras.experience) {
    conflicts.push(
      ...detectExperienceConflicts(semantic.entities, extras.experience, declaredEvents, declaredAtomics),
    )
  }

  return conflicts
}

const SCALAR_UNIQUE_TYPES = new Set([
  'text',
  'number',
  'decimal',
  'boolean',
  'date',
  'datetime',
  'i32',
  'enum',
])
const UOM_FIELD_TYPES = new Set(['number', 'decimal', 'i32'])

function detectSemanticP0Conflicts(semantic: { entities: SemanticEntity[] }): string[] {
  const conflicts: string[] = []
  const entityByName = new Map(semantic.entities.map((entity) => [entity.name, entity]))

  for (const entity of semantic.entities) {
    const fieldByName = new Map(entity.fields.map((field) => [field.name, field]))
    const fieldNames = entity.fields.map((field) => field.name)

    for (const childName of entity.children ?? []) {
      const child = entityByName.get(childName)
      if (!child) {
        conflicts.push(`主从不一致：${entity.name}.children 引用了未声明实体 ${childName}`)
        continue
      }
      if (!child.parent) {
        conflicts.push(
          `主从不一致：${entity.name} 声明了行 ${childName}，但 ${childName} 未声明 parent`,
        )
        continue
      }
      if (child.parent.entity !== entity.name) {
        conflicts.push(
          `主从不一致：${entity.name} 声明了行 ${childName}，但 ${childName}.parent.entity 回指 ${child.parent.entity} 而不是 ${entity.name}`,
        )
      }
    }

    if (entity.parent) {
      const head = entityByName.get(entity.parent.entity)
      if (!head) {
        conflicts.push(
          `主从不一致：${entity.name}.parent.entity 指向未声明实体 ${entity.parent.entity}`,
        )
      } else if (!(head.children ?? []).includes(entity.name)) {
        conflicts.push(
          `主从不一致：${entity.name}.parent 回指 ${entity.parent.entity}，但该头的 children 未包含 ${entity.name}`,
        )
      }
      const parentField = fieldByName.get(entity.parent.field)
      if (!parentField) {
        conflicts.push(
          `主从不一致：${entity.name}.parent.field「${entity.parent.field}」不是本行实体上已声明的字段`,
        )
      } else if (
        parentField.type !== 'reference' ||
        parentField.reference !== entity.parent.entity
      ) {
        conflicts.push(
          `主从不一致：${entity.name}.${entity.parent.field} 必须是 type=reference 且 reference=${entity.parent.entity}（实际 type=${parentField.type} reference=${parentField.reference ?? '-'}）`,
        )
      }
    }

    for (const relation of entity.relations ?? []) {
      if (relation.type === 'manyToMany') {
        conflicts.push(
          `关系基数非法：${entity.name}.${relation.name} 声明了 manyToMany；请声明一个显式中间实体，用两条 reference/many 关系表达`,
        )
      }
    }

    for (const field of entity.fields) {
      pushFieldP0Conflicts(conflicts, entity.name, field, fieldByName, fieldNames)
    }
    conflicts.push(...detectOwnershipConflicts(entity, fieldByName))

    const edges = new Map<string, string[]>()
    for (const field of entity.fields) {
      if (field.computed) {
        edges.set(field.name, [...field.computed.dependsOn])
      }
    }
    for (const deps of edges.values()) {
      for (const dep of deps) {
        if (!edges.has(dep)) edges.set(dep, [])
      }
    }
    const cycle = findDependsOnCycle(edges)
    if (cycle) {
      conflicts.push(`循环依赖：${entity.name} 的计算字段存在环 ${cycle.join(' → ')}`)
    }

    conflicts.push(...detectRollupConflicts(entity, entityByName))
  }

  return conflicts
}

const ROLLUP_FNS = new Set(['sum', 'count', 'max', 'min'])

function detectRollupConflicts(
  entity: SemanticEntity,
  entityByName: Map<string, SemanticEntity>,
): string[] {
  const conflicts: string[] = []
  const fieldByName = new Map(entity.fields.map((field) => [field.name, field]))
  const rollupFields = new Set((entity.rollups ?? []).map((item) => item.field))

  for (const rollup of entity.rollups ?? []) {
    const path = `${entity.name}.rollups.${rollup.field}`
    const target = fieldByName.get(rollup.field)
    if (!target) {
      conflicts.push(`合计非法：${path} 的 field 不是本实体已声明字段`)
      continue
    }
    if (!ROLLUP_FNS.has(rollup.fn)) {
      conflicts.push(`合计非法：${path} 的 fn「${rollup.fn}」不在 sum|count|max|min`)
    }
    if (!(entity.children ?? []).includes(rollup.over)) {
      conflicts.push(
        `合计非法：${path} 的 over「${rollup.over}」不是 ${entity.name}.children 里声明过的行实体`,
      )
      continue
    }
    const child = entityByName.get(rollup.over)
    if (!child) {
      conflicts.push(`合计非法：${path} 的 over「${rollup.over}」不是已声明实体`)
      continue
    }
    const ofField = child.fields.find((field) => field.name === rollup.of)
    if (!ofField) {
      conflicts.push(
        `合计非法：${path} 的 of「${rollup.of}」不是行实体 ${rollup.over} 的已声明字段`,
      )
      continue
    }
    if ((child.rollups ?? []).some((item) => item.field === rollup.of)) {
      conflicts.push(`合计非法：${path} 的 of 指向另一层 rollup 字段（本轮只做一层）`)
    }
    if (target.type === 'decimal' && ofField.type !== 'decimal') {
      conflicts.push(
        `合计非法：${path} 的 field 是 decimal，of 必须也是 decimal（金额只能合计金额）`,
      )
    }
    if (target.money === true || ofField.money === true) {
      const targetCcy = target.currency
      const ofCcy = ofField.currency
      if (targetCcy && ofCcy && targetCcy !== ofCcy) {
        conflicts.push(
          `货币冲突：${path} 的 of「${rollup.over}.${rollup.of}」是 ${ofCcy}，目标 ${entity.name}.${rollup.field} 是 ${targetCcy}，不同货币不得相加`,
        )
      }
    }
    if (rollupFields.has(rollup.of) && rollup.over === entity.name) {
      conflicts.push(`合计非法：${path} 的 of 指向另一层 rollup 字段（本轮只做一层）`)
    }
  }
  return conflicts
}

function detectSemanticP1Conflicts(semantic: { entities: SemanticEntity[] }): string[] {
  const conflicts: string[] = []

  for (const entity of semantic.entities) {
    const fieldByName = new Map(entity.fields.map((field) => [field.name, field]))

    for (const field of entity.fields) {
      if (RESERVED_FIELD_NAMES.has(field.name)) {
        conflicts.push(
          `保留字冲突：${entity.name}.${field.name} 与运行时/列保留名冲突（children / state / version / id / createdAt / updatedAt）`,
        )
      }
      if (field.onDelete !== undefined) {
        if (field.type !== 'reference') {
          conflicts.push(
            `删除策略非法：${entity.name}.${field.name} 声明了 onDelete，但 type 是 ${field.type}（只允许用在 reference 上）`,
          )
        } else if (!ON_DELETE_POLICIES.has(field.onDelete)) {
          conflicts.push(
            `删除策略非法：${entity.name}.${field.name} 的 onDelete=${field.onDelete}（只接受 restrict | setNull；cascade 本轮不做）`,
          )
        }
      }
    }

    if (!entity.numbering) continue
    const numbering = entity.numbering
    const path = `${entity.name}.numbering`
    if (!numbering.prefix || numbering.prefix.trim() === '') {
      conflicts.push(`单号非法：${path}.prefix 不能为空`)
    }
    if (!Number.isInteger(numbering.width) || numbering.width < 1 || numbering.width > 12) {
      conflicts.push(`单号非法：${path}.width=${numbering.width} 必须是 1..12 的整数`)
    }
    const dateFormat = numbering.dateFormat ?? 'YYYYMMDD'
    if (!NUMBERING_DATE_FORMATS.has(dateFormat)) {
      conflicts.push(
        `单号非法：${path}.dateFormat=${numbering.dateFormat} 必须是 YYYYMMDD | YYYYMM | YYYY | none`,
      )
    }
    const field = fieldByName.get(numbering.field)
    if (!field) {
      conflicts.push(`单号非法：${path}.field「${numbering.field}」不是本实体已声明字段`)
    } else {
      if (field.type !== 'text') {
        conflicts.push(
          `单号非法：${entity.name}.${numbering.field} 必须是 type=text（实际 type=${field.type}）`,
        )
      }
      if (field.unique !== true) {
        conflicts.push(
          `单号非法：${entity.name}.${numbering.field} 必须 unique: true（数据库唯一约束兜底否则是空话）`,
        )
      }
    }
  }

  return conflicts
}

const DATE_DEFAULT_RE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_DEFAULT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
const DECIMAL_DEFAULT_RE = /^-?\d+(\.\d+)?$/
const I32_MIN = -2147483648
const I32_MAX = 2147483647

function describeIllegalDefault(field: SemanticField): string | undefined {
  const value = field.default
  switch (field.type) {
    case 'text':
      return typeof value === 'string' ? undefined : 'text 的 default 必须是字符串'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? undefined
        : 'number 的 default 必须是有限数字'
    case 'decimal':
      if (typeof value === 'string' && DECIMAL_DEFAULT_RE.test(value)) return undefined
      if (typeof value === 'number' && Number.isFinite(value)) return undefined
      return 'decimal 的 default 必须是小数串或有限数字'
    case 'boolean':
      return typeof value === 'boolean' ? undefined : 'boolean 的 default 必须是布尔'
    case 'i32':
      return Number.isInteger(value) && (value as number) >= I32_MIN && (value as number) <= I32_MAX
        ? undefined
        : 'i32 的 default 必须是 32 位整数'
    case 'date':
      return typeof value === 'string' && DATE_DEFAULT_RE.test(value)
        ? undefined
        : 'date 的 default 必须是 YYYY-MM-DD'
    case 'datetime':
      return typeof value === 'string' && DATETIME_DEFAULT_RE.test(value)
        ? undefined
        : 'datetime 的 default 必须是既有 ISO 格式'
    case 'enum':
      return typeof value === 'string' ? undefined : 'enum 的 default 必须是字符串'
    default:
      return `type=${field.type} 不能声明 default`
  }
}

function pushDefaultConflicts(conflicts: string[], path: string, field: SemanticField): void {
  if (field.default === undefined) return
  if (field.type === 'reference') {
    conflicts.push(`默认值非法：${path} 是 reference，不能声明 default`)
    return
  }
  if (field.computed) {
    conflicts.push(`默认值非法：${path} 是计算字段，不能声明 default`)
    return
  }
  const typeError = describeIllegalDefault(field)
  if (typeError) {
    conflicts.push(`默认值类型不符：${path} ${typeError}`)
    return
  }
  if (field.type === 'enum' && field.values && !field.values.includes(field.default as string)) {
    conflicts.push(`默认值非法：${path} 的 default「${String(field.default)}」不在 values 里`)
  }
}

function detectOwnershipConflicts(
  entity: SemanticEntity,
  fieldByName: Map<string, SemanticField>,
): string[] {
  const conflicts: string[] = []
  if (!entity.ownership) return conflicts
  const path = `${entity.name}.ownership`
  const field = fieldByName.get(entity.ownership.field)
  if (!field) {
    conflicts.push(
      `归属非法：${path}.field「${entity.ownership.field}」不是本实体已声明字段`,
    )
  } else if (field.type !== 'text') {
    conflicts.push(
      `归属非法：${path}.field「${entity.ownership.field}」必须是 type=text（实际 type=${field.type}）`,
    )
  }
  if (!DOTTED_PERMISSION.test(entity.ownership.readAllPermission)) {
    conflicts.push(
      `权限非法：${path}.readAllPermission「${entity.ownership.readAllPermission}」必须是点分权限`,
    )
  }
  return conflicts
}

function pushFieldP0Conflicts(
  conflicts: string[],
  entityName: string,
  field: SemanticField,
  fieldByName: Map<string, SemanticField>,
  fieldNames: string[],
): void {
  const path = `${entityName}.${field.name}`
  pushDefaultConflicts(conflicts, path, field)

  if (field.money === true && !field.currency) {
    conflicts.push(`货币非法：${path} 声明了 money: true，但未声明 currency`)
  }
  if (field.currency && field.money !== true) {
    conflicts.push(`货币非法：${path} 声明了 currency，但不是金额字段（currency 只能出现在 money: true 上）`)
  }
  if (field.currency && !ISO_CURRENCY.test(field.currency)) {
    conflicts.push(`货币非法：${path} 的 currency「${field.currency}」必须是三位大写字母`)
  }

  if (field.permissions) {
    if (field.permissions.read !== undefined && !DOTTED_PERMISSION.test(field.permissions.read)) {
      conflicts.push(`权限非法：${path}.permissions.read「${field.permissions.read}」必须是点分权限`)
    }
    if (field.permissions.write !== undefined && !DOTTED_PERMISSION.test(field.permissions.write)) {
      conflicts.push(`权限非法：${path}.permissions.write「${field.permissions.write}」必须是点分权限`)
    }
  }

  if (field.money === true && field.type !== 'decimal') {
    conflicts.push(
      `金额类型非法：${path} 声明了 money: true，但 type 是 ${field.type}（金额必须用 decimal，不能用 number）`,
    )
  }

  const hasDecimalMeta =
    field.precision !== undefined || field.scale !== undefined || field.rounding !== undefined
  if (hasDecimalMeta && field.type !== 'decimal') {
    conflicts.push(
      `定点属性非法：${path} 的 precision/scale/rounding 只能出现在 decimal 字段上（实际 type=${field.type}）`,
    )
  }

  if (field.type === 'decimal') {
    const precision = field.precision ?? 18
    const scale = field.scale ?? 4
    if (field.precision !== undefined && !Number.isInteger(field.precision)) {
      conflicts.push(`精度非法：${path} 的 precision 必须是整数`)
    } else if (field.precision !== undefined && (field.precision < 1 || field.precision > 38)) {
      conflicts.push(`精度非法：${path} 的 precision=${field.precision} 超出 1..38`)
    }
    if (field.scale !== undefined && !Number.isInteger(field.scale)) {
      conflicts.push(`标度非法：${path} 的 scale 必须是整数`)
    } else if (field.scale !== undefined && field.scale < 0) {
      conflicts.push(`标度非法：${path} 的 scale=${field.scale}`)
    }
    if (Number.isInteger(precision) && Number.isInteger(scale) && scale > precision) {
      conflicts.push(`标度非法：${path} 的 scale=${scale} 大于 precision=${precision}`)
    }
    if (field.rounding !== undefined && field.rounding !== 'half-up' && field.rounding !== 'half-even') {
      conflicts.push(`舍入非法：${path} 的 rounding=${field.rounding}`)
    }
  }

  if (field.type === 'enum') {
    if (!field.values || field.values.length === 0) {
      conflicts.push(`枚举非法：${path} 的 type=enum 要求非空 values`)
    } else {
      const seen = new Set<string>()
      for (const value of field.values) {
        if (seen.has(value)) {
          conflicts.push(`枚举非法：${path} 的 values 含重复值 ${value}`)
        }
        seen.add(value)
      }
    }
  } else if (field.values) {
    conflicts.push(`枚举非法：${path} 的 values 只能出现在 type=enum 字段上`)
  }

  if (field.unique === true) {
    if (field.computed) {
      conflicts.push(`唯一性非法：${path} 是计算字段，不能声明 unique（派生值唯一属后续）`)
    } else if (field.type === 'reference') {
      conflicts.push(`唯一性非法：${path} 是 reference，不能声明 unique（跨表唯一属后续）`)
    } else if (!SCALAR_UNIQUE_TYPES.has(field.type)) {
      conflicts.push(`唯一性非法：${path} 的类型 ${field.type} 不是可声明 unique 的标量`)
    }
  }

  if (field.uom) {
    if (!UOM_FIELD_TYPES.has(field.type)) {
      conflicts.push(
        `单位非法：${path} 的 uom 只能出现在 number/decimal/i32 上（实际 type=${field.type}）`,
      )
    }
    if (!field.uom.base || field.uom.base.trim() === '') {
      conflicts.push(`单位非法：${path} 的 uom.base 不能为空`)
    }
    if (!field.uom.packs || field.uom.packs.length < 1) {
      conflicts.push(`单位非法：${path} 的 uom.packs 至少要有 1 项`)
    } else {
      const names = new Set<string>()
      for (const pack of field.uom.packs) {
        if (!pack.name || pack.name.trim() === '') {
          conflicts.push(`单位非法：${path} 的 pack.name 不能为空`)
        } else if (names.has(pack.name)) {
          conflicts.push(`单位非法：${path} 的 pack.name「${pack.name}」重复`)
        }
        names.add(pack.name)
        const factorError = describeIllegalFactor(pack.factor)
        if (factorError) {
          conflicts.push(`单位非法：${path} 的 pack「${pack.name}」${factorError}`)
        }
      }
    }
  }

  if (!field.computed) return

  const parsed = parseComputedExpression(field.computed.expr)
  if (!parsed.ok) {
    conflicts.push(`计算字段非法：${path} 的 expr「${field.computed.expr}」${parsed.error}`)
    return
  }
  for (const ident of parsed.identifiers) {
    if (!fieldNames.includes(ident)) {
      conflicts.push(`计算字段非法：${path} 的 expr 引用了本实体未声明的字段 ${ident}`)
    }
  }
  for (const dep of field.computed.dependsOn) {
    if (!fieldNames.includes(dep)) {
      conflicts.push(`计算字段非法：${path} 的 dependsOn 引用了本实体未声明的字段 ${dep}`)
    }
  }
  for (const ident of parsed.identifiers) {
    if (!field.computed.dependsOn.includes(ident)) {
      conflicts.push(
        `计算字段非法：${path} 的 dependsOn 未覆盖 expr 标识符 ${ident}（dependsOn 是环路判定的输入，漏一项环路检测就不完整）`,
      )
    }
  }

  const moneyRefs = parsed.identifiers
    .map((ident) => fieldByName.get(ident))
    .filter((item): item is SemanticField => item !== undefined && item.money === true && !!item.currency)
  const currencies = [...new Set(moneyRefs.map((item) => item.currency as string))]
  if (currencies.length > 1) {
    const left = moneyRefs.find((item) => item.currency === currencies[0])
    const right = moneyRefs.find((item) => item.currency === currencies[1])
    conflicts.push(
      `货币冲突：${path} 的 expr 引用了 ${entityName}.${left?.name}（${currencies[0]}）与 ${entityName}.${right?.name}（${currencies[1]}），不同货币不得相加`,
    )
  }
}

function describeIllegalFactor(factor: SemanticUomPack['factor'] | unknown): string | null {
  if (typeof factor === 'number') {
    if (!Number.isInteger(factor) || factor <= 0) {
      return `factor 必须是正整数（实际 ${String(factor)}）`
    }
    return null
  }
  if (factor && typeof factor === 'object' && !Array.isArray(factor)) {
    const rec = factor as { numerator?: unknown; denominator?: unknown }
    if (typeof rec.numerator !== 'number' || !Number.isInteger(rec.numerator) || rec.numerator <= 0) {
      return 'factor.numerator 必须是正整数'
    }
    if (
      typeof rec.denominator !== 'number' ||
      !Number.isInteger(rec.denominator) ||
      rec.denominator <= 0
    ) {
      return 'factor.denominator 必须是正整数'
    }
    return null
  }
  return 'factor 必须是正整数或 {numerator, denominator}'
}

function findDependsOnCycle(edges: Map<string, string[]>): string[] | null {
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []

  const visit = (id: string): string[] | null => {
    if (state.get(id) === 'visiting') {
      const from = stack.indexOf(id)
      return [...stack.slice(from), id]
    }
    if (state.get(id) === 'done') return null
    state.set(id, 'visiting')
    stack.push(id)
    for (const next of edges.get(id) ?? []) {
      const found = visit(next)
      if (found) return found
    }
    stack.pop()
    state.set(id, 'done')
    return null
  }

  for (const id of [...edges.keys()].sort()) {
    const found = visit(id)
    if (found) return found
  }
  return null
}

function fieldNamesOf(
  entities: SemanticEntity[],
  entityName: string,
): string[] | null {
  const entity = entities.find((candidate) => candidate.name === entityName)
  return entity ? entity.fields.map((field) => field.name) : null
}

function stateNamesOf(
  entities: SemanticEntity[],
  entityName: string,
): string[] | null {
  const entity = entities.find((candidate) => candidate.name === entityName)
  return entity ? entity.states.map((state) => state.name) : null
}

function detectRuleConflicts(
  entities: SemanticEntity[],
  rules: RulesFile,
  declaredEvents: string[],
): string[] {
  const conflicts: string[] = []

  for (const rule of rules.validation) {
    const fields = fieldNamesOf(entities, rule.entity)
    if (!fields) {
      conflicts.push(`悬空引用：校验规则 ${rule.id} 引用了不存在的实体 ${rule.entity}`)
      continue
    }
    if (!fields.includes(rule.field)) {
      conflicts.push(
        `悬空引用：校验规则 ${rule.id} 引用了 ${rule.entity} 上不存在的字段 ${rule.field}`,
      )
    }
  }

  for (const rule of rules.approval) {
    const fields = fieldNamesOf(entities, rule.entity)
    if (!fields) {
      conflicts.push(`悬空引用：审批规则 ${rule.id} 引用了不存在的实体 ${rule.entity}`)
    }
    const parsed = parseRestrictedExpression(rule.when)
    if (!parsed.ok) {
      conflicts.push(`表达式非法：审批规则 ${rule.id} 的 when「${rule.when}」${parsed.error}`)
    } else {
      for (const ident of parsed.identifiers) {
        if (ident.includes('.')) {
          const [entityName, fieldName] = ident.split('.')
          const targetFields = fieldNamesOf(entities, entityName)
          if (!targetFields) {
            conflicts.push(
              `悬空引用：审批规则 ${rule.id} 的 when 引用了不存在的实体 ${entityName}`,
            )
          } else if (!targetFields.includes(fieldName)) {
            conflicts.push(
              `悬空引用：审批规则 ${rule.id} 的 when 引用了 ${entityName} 上不存在的字段 ${fieldName}`,
            )
          }
        } else if (fields && !fields.includes(ident)) {
          conflicts.push(
            `悬空引用：审批规则 ${rule.id} 的 when 引用了 ${rule.entity} 上不存在的字段 ${ident}`,
          )
        }
      }
    }
    for (const step of rule.steps) {
      if (!PLATFORM_APPROVAL_ROLES.has(step.role)) {
        conflicts.push(`未知角色：审批规则 ${rule.id} 的步骤角色 ${step.role} 不在平台已知角色目录`)
      }
    }
  }

  for (const rule of rules.accounting) {
    if (!declaredEvents.includes(rule.on)) {
      conflicts.push(`悬空引用：记账规则 ${rule.id} 触发于未声明的事件 ${rule.on}`)
    }
    const eventEntity = rule.on.split('.')[0]
    for (const entry of rule.entries) {
      if (typeof entry.amount !== 'string' || isLiteralAmount(entry.amount)) continue
      const ref = parseEntityFieldRef(entry.amount)
      if (!ref) {
        conflicts.push(
          `悬空引用：记账规则 ${rule.id} 的金额「${entry.amount}」既不是字面量也不是 $entity.field`,
        )
        continue
      }
      const entityName = ref.entity === 'entity' ? eventEntity : ref.entity
      const fields = fieldNamesOf(entities, entityName)
      if (!fields) {
        conflicts.push(`悬空引用：记账规则 ${rule.id} 的金额引用了不存在的实体 ${entityName}`)
      } else if (!fields.includes(ref.field)) {
        conflicts.push(
          `悬空引用：记账规则 ${rule.id} 的金额引用了 ${entityName} 上不存在的字段 ${ref.field}`,
        )
      }
    }
    conflicts.push(...detectAccountingCurrencyConflicts(entities, rule, eventEntity))
    const balance = checkAccountingBalance(rule)
    if (balance) conflicts.push(balance)
  }

  return conflicts
}

function formatAmounts(entries: AccountingEntry[]): string {
  return entries.map((entry) => String(entry.amount)).join(', ')
}

function isLiteralAmount(amount: number | string): boolean {
  if (typeof amount === 'number') return Number.isFinite(amount)
  return /^-?\d+(\.\d+)?$/.test(amount)
}

function parseEntityFieldRef(amount: string): { entity: string; field: string } | null {
  const match = amount.match(/^\$([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)$/)
  if (!match) return null
  return { entity: match[1], field: match[2] }
}

function fieldOf(
  entities: SemanticEntity[],
  entityName: string,
  fieldName: string,
): SemanticField | undefined {
  return entities.find((item) => item.name === entityName)?.fields.find((field) => field.name === fieldName)
}

function detectAccountingCurrencyConflicts(
  entities: SemanticEntity[],
  rule: AccountingRule,
  eventEntity: string,
): string[] {
  const moneyRefs: Array<{ path: string; currency: string }> = []
  for (const entry of rule.entries) {
    if (typeof entry.amount !== 'string' || isLiteralAmount(entry.amount)) continue
    const ref = parseEntityFieldRef(entry.amount)
    if (!ref) continue
    const entityName = ref.entity === 'entity' ? eventEntity : ref.entity
    const field = fieldOf(entities, entityName, ref.field)
    if (field?.money === true && field.currency) {
      moneyRefs.push({ path: `${entityName}.${ref.field}`, currency: field.currency })
    }
  }
  const currencies = [...new Set(moneyRefs.map((item) => item.currency))]
  if (currencies.length <= 1) return []
  const left = moneyRefs.find((item) => item.currency === currencies[0])
  const right = moneyRefs.find((item) => item.currency === currencies[1])
  return [
    `货币冲突：记账规则 ${rule.id} 引用了 ${left?.path}（${currencies[0]}）与 ${right?.path}（${currencies[1]}），不同货币不得相加`,
  ]
}

function literalValue(amount: number | string): number {
  return typeof amount === 'number' ? amount : Number(amount)
}

/**
 * 平衡只做能做的那一半：字面量比合计、引用比表达式字符串多重集合。
 * 不做代数化简；一侧字面量一侧引用直接拒。错信息必须带上两侧的具体值。
 */
function checkAccountingBalance(rule: AccountingRule): string | null {
  const debits = rule.entries.filter((entry) => entry.side === 'debit')
  const credits = rule.entries.filter((entry) => entry.side === 'credit')
  const debitText = formatAmounts(debits)
  const creditText = formatAmounts(credits)

  if (debits.length === 0 || credits.length === 0) {
    return `记账不平衡：规则 ${rule.id} 借方 [${debitText}] 贷方 [${creditText}]`
  }

  const allLiteral = rule.entries.every((entry) => isLiteralAmount(entry.amount))
  const allReference = rule.entries.every((entry) => !isLiteralAmount(entry.amount))

  if (allLiteral) {
    const debitSum = debits.reduce((sum, entry) => sum + literalValue(entry.amount), 0)
    const creditSum = credits.reduce((sum, entry) => sum + literalValue(entry.amount), 0)
    if (debitSum !== creditSum) {
      return `记账不平衡：规则 ${rule.id} 借方 [${debitText} = ${debitSum}] 贷方 [${creditText} = ${creditSum}]`
    }
    return null
  }

  if (allReference) {
    const debitExprs = debits.map((entry) => String(entry.amount)).sort()
    const creditExprs = credits.map((entry) => String(entry.amount)).sort()
    if (debitExprs.join('\0') !== creditExprs.join('\0')) {
      return `记账不平衡：规则 ${rule.id} 借方 [${debitText}] 贷方 [${creditText}]`
    }
    return null
  }

  return `记账不平衡：规则 ${rule.id} 借方 [${debitText}] 贷方 [${creditText}]（一侧字面量一侧引用，不可静态判定）`
}

function detectExperienceConflicts(
  entities: SemanticEntity[],
  experience: ExperienceFile,
  declaredEvents: string[],
  declaredAtomics: Set<string>,
): string[] {
  const conflicts: string[] = []

  for (const item of experience.priority) {
    const fields = fieldNamesOf(entities, item.entity)
    if (!fields) {
      conflicts.push(`悬空引用：经验策略 priority 引用了不存在的实体 ${item.entity}`)
      continue
    }
    for (const field of item.fields) {
      if (!fields.includes(field)) {
        conflicts.push(
          `悬空引用：经验策略 priority 引用了 ${item.entity} 上不存在的字段 ${field}`,
        )
      }
    }
  }

  const resolveAction = (action: string, where: string): void => {
    if (declaredEvents.includes(action) || declaredAtomics.has(action)) return
    conflicts.push(
      `悬空引用：经验策略 ${where} 的动作 ${action} 既不是已声明事件 Entity.state，也不是清单里的原子类型`,
    )
  }

  for (const item of experience.confirm) {
    resolveAction(item.action, 'confirm')
    const [entityName, fieldName] = item.when.field.split('.')
    const fields = fieldNamesOf(entities, entityName)
    if (!fields) {
      conflicts.push(`悬空引用：经验策略 confirm.when 引用了不存在的实体 ${entityName}`)
    } else if (!fields.includes(fieldName)) {
      conflicts.push(
        `悬空引用：经验策略 confirm.when 引用了 ${entityName} 上不存在的字段 ${fieldName}`,
      )
    }
  }

  for (const item of experience.automate) {
    resolveAction(item.action, 'automate')
  }

  for (const item of experience.surfaces) {
    const states = stateNamesOf(entities, item.when.entity)
    if (!states) {
      conflicts.push(`悬空引用：经验策略 surfaces ${item.id} 引用了不存在的实体 ${item.when.entity}`)
    } else if (!states.includes(item.when.state)) {
      conflicts.push(
        `悬空引用：经验策略 surfaces ${item.id} 引用了 ${item.when.entity} 上不存在的状态 ${item.when.state}`,
      )
    }
  }

  return conflicts
}

function layerDigest(layer: unknown): BlueprintIrLayerDigest {
  const count = countLayerItems(layer)
  const digest = `sha256:${createHash('sha256').update(canonicalizeJson(layer)).digest('hex')}`
  return { count, digest }
}

/** 语义层摘要：count = 实体数；digest 覆盖字段类型/精度/唯一性/计算式，不只计数字段。 */
function semanticLayerDigest(semantic: unknown): BlueprintIrLayerDigest {
  const entities = (semantic as { entities?: unknown[] }).entities
  const count = Array.isArray(entities) ? entities.length : 0
  const digest = `sha256:${createHash('sha256').update(canonicalizeJson(semantic)).digest('hex')}`
  return { count, digest }
}

function countLayerItems(layer: unknown): number {
  if (!layer || typeof layer !== 'object') return 0
  const record = layer as Record<string, unknown>
  const keys = ['validation', 'approval', 'accounting', 'priority', 'confirm', 'automate', 'surfaces']
  return keys.reduce((sum, key) => {
    const value = record[key]
    return sum + (Array.isArray(value) ? value.length : 0)
  }, 0)
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) dupes.add(value)
    seen.add(value)
  }
  return [...dupes]
}

/** DFS 找步骤图的环（含自环），返回环上的步骤序列。 */
function findCycle(
  steps: Array<{ id: string; next?: string[] }>,
): string[] | null {
  const edges = new Map(steps.map((step) => [step.id, step.next ?? []]))
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []

  const visit = (id: string): string[] | null => {
    if (state.get(id) === 'visiting') {
      const from = stack.indexOf(id)
      return [...stack.slice(from), id]
    }
    if (state.get(id) === 'done') return null
    state.set(id, 'visiting')
    stack.push(id)
    for (const next of edges.get(id) ?? []) {
      const found = visit(next)
      if (found) return found
    }
    stack.pop()
    state.set(id, 'done')
    return null
  }

  for (const step of steps) {
    const found = visit(step.id)
    if (found) return found
  }
  return null
}

/** 结构化 IR → 文本 IR（语法见 docs/protocols/blueprint-ir.md）。 */
export function toIrText(ir: BlueprintIr): string {
  const lines: string[] = [
    `blueprint ${ir.blueprint}@${ir.version}`,
    `runtime ${ir.runtime}`,
  ]
  for (const entity of ir.entities) {
    const states = entity.states.length ? entity.states.join(' -> ') : '-'
    lines.push(`entity ${entity.name} { fields: ${entity.fieldCount}, states: ${states} }`)
  }
  for (const event of ir.events) {
    lines.push(`on ${event.on}:`)
    for (const action of event.actions) {
      lines.push(`  ${actionToText(action)}`)
    }
  }
  for (const dependency of ir.dependencies) {
    lines.push(`depends ${dependency}`)
  }
  if (ir.semantic) {
    lines.push(`semantic count=${ir.semantic.count} digest=${ir.semantic.digest}`)
  }
  if (ir.rules) {
    lines.push(`rules count=${ir.rules.count} digest=${ir.rules.digest}`)
  }
  if (ir.experience) {
    lines.push(`experience count=${ir.experience.count} digest=${ir.experience.digest}`)
  }
  return `${lines.join('\n')}\n`
}

function actionToText(action: BlueprintIrAction): string {
  const when = action.when ? ` when ${action.when}` : ''
  switch (action.kind) {
    case 'check':
      return `check${action.rule ? ` ${action.rule}` : ''} using atomic:${action.atomic}${when}`
    case 'require-approval':
      return `require approval ${action.rule}${when}`
    case 'post-accounting':
      return `post accounting ${action.entry}${when}`
  }
}

/**
 * 文本 IR → 结构化 IR（不含 summary：它是派生信息，不参与等价性判断）。
 * 与 `toIrText` 构成往返对，由测试保证 `parseIrText(toIrText(ir))` 与 `ir` 等价。
 */
export function parseIrText(text: string): Omit<BlueprintIr, 'summary'> {
  const lines = text.split('\n').filter((line) => line.trim().length > 0)
  let header: { blueprint: string; version: string } | null = null
  let runtime = ''
  const entities: BlueprintIr['entities'] = []
  const events: BlueprintIrEvent[] = []
  const dependencies: string[] = []
  let semantic: BlueprintIr['semantic']
  let rules: BlueprintIr['rules']
  let experience: BlueprintIr['experience']

  for (const raw of lines) {
    const line = raw.trimEnd()
    const trimmed = line.trim()

    if (trimmed.startsWith('blueprint ')) {
      const match = trimmed.match(/^blueprint (.+)@(\d+\.\d+\.\d+)$/)
      if (!match) throw new CompileError(`无法解析头部：${trimmed}`, 'conflict')
      header = { blueprint: match[1], version: match[2] }
      continue
    }
    if (trimmed.startsWith('runtime ')) {
      runtime = trimmed.slice('runtime '.length)
      continue
    }
    if (trimmed.startsWith('entity ')) {
      const match = trimmed.match(/^entity (\S+) \{ fields: (\d+), states: (.+) \}$/)
      if (!match) throw new CompileError(`无法解析实体行：${trimmed}`, 'conflict')
      entities.push({
        name: match[1],
        fieldCount: Number(match[2]),
        states: match[3] === '-' ? [] : match[3].split(' -> '),
      })
      continue
    }
    if (trimmed.startsWith('on ')) {
      events.push({ on: trimmed.slice(3).replace(/:$/, ''), actions: [] })
      continue
    }
    if (trimmed.startsWith('depends ')) {
      dependencies.push(trimmed.slice('depends '.length))
      continue
    }
    const layer = trimmed.match(/^(semantic|rules|experience) count=(\d+) digest=(sha256:[0-9a-f]{64})$/)
    if (layer) {
      const digest = { count: Number(layer[2]), digest: layer[3] }
      if (layer[1] === 'semantic') semantic = digest
      else if (layer[1] === 'rules') rules = digest
      else experience = digest
      continue
    }
    if (line.startsWith('  ')) {
      const event = events[events.length - 1]
      if (!event) throw new CompileError(`动作不属于任何事件：${trimmed}`, 'conflict')
      event.actions.push(parseActionText(trimmed))
      continue
    }
    throw new CompileError(`无法解析的行：${trimmed}`, 'conflict')
  }

  if (!header) throw new CompileError('文本 IR 缺少头部', 'conflict')
  return {
    ir: 'blueprint-ir/v1',
    blueprint: header.blueprint,
    version: header.version,
    runtime,
    entities,
    events,
    dependencies,
    ...(semantic ? { semantic } : {}),
    ...(rules ? { rules } : {}),
    ...(experience ? { experience } : {}),
  }
}

function parseActionText(text: string): BlueprintIrAction {
  const whenIndex = text.indexOf(' when ')
  const when = whenIndex >= 0 ? text.slice(whenIndex + ' when '.length) : undefined
  const head = whenIndex >= 0 ? text.slice(0, whenIndex) : text

  const check = head.match(/^check(?: (\S+))? using atomic:(\S+)$/)
  if (check) {
    return {
      kind: 'check',
      ...(check[1] ? { rule: check[1] } : {}),
      atomic: check[2],
      ...(when ? { when } : {}),
    }
  }
  const approval = head.match(/^require approval (\S+)$/)
  if (approval) {
    return { kind: 'require-approval', rule: approval[1], ...(when ? { when } : {}) }
  }
  const accounting = head.match(/^post accounting (\S+)$/)
  if (accounting) {
    return { kind: 'post-accounting', entry: accounting[1], ...(when ? { when } : {}) }
  }
  throw new CompileError(`无法解析的动作：${text}`, 'conflict')
}
