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
import { parseRestrictedExpression } from './rules-expression'

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

interface SemanticEntity {
  name: string
  fields: Array<{ name: string; type: string; required?: boolean; reference?: string }>
  relations?: Array<{ name: string; type: string; target: string }>
  states: Array<{ name: string; initial?: boolean; final?: boolean }>
  transitions?: Array<{ from: string; to: string; rule?: string }>
}

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
    const layer = trimmed.match(/^(rules|experience) count=(\d+) digest=(sha256:[0-9a-f]{64})$/)
    if (layer) {
      const digest = { count: Number(layer[2]), digest: layer[3] }
      if (layer[1] === 'rules') rules = digest
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
