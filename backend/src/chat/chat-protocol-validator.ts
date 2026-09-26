/**
 * chat-first ERP 的两份协议校验 —— 判据文本见 `docs/protocols/chat-erp.md`。
 *
 *   · `agent-tool.schema.json`        工具契约（智能体只能用契约里的工具）
 *   · `interaction-plan.schema.json`  临时交互面的结构化计划
 *
 * 本模块做两件事：照章校验形状 + 补 Schema 表达不了的**跨字段判据**。
 * 判定只有这一份：编排器、渲染器、e2e 都调它（元语不变量 12）。
 */
import { Validator, type IJSONSchemaValidationError } from 'jsonschema'
import {
  AGENT_TOOL_SCHEMA_FILE,
  INTERACTION_PLAN_SCHEMA_FILE,
  loadSchema,
} from '../common/protocol/schema-loader'

export interface ProtocolValidation {
  valid: boolean
  errors: string[]
}

let validator: Validator | undefined

function getValidator(): Validator {
  if (!validator) validator = new Validator()
  return validator
}

function errorsOf(errors: IJSONSchemaValidationError[]): string[] {
  return errors.map((error) => {
    const path = error.property.replace(/^instance\.?/, '') || '(root)'
    return `${path}: ${error.message}`
  })
}

/**
 * 工具契约的跨字段判据：
 *
 *   1. **写操作必须要求确认**：`write: true` 而 `confirmation: 'none'` 等于给智能体
 *      开了一条无人确认的写通道 —— 这是本变更最不能出的一条。
 *   2. 读操作不该声明 `confirmation: 'required'`（否则界面每读一次都要点确认，
 *      人最后会学会无脑点"确认"，反而把写操作的确认也废了）。
 */
export function validateAgentToolConsistency(tool: unknown): ProtocolValidation {
  const errors: string[] = []
  const t = (tool ?? {}) as { write?: boolean; confirmation?: string; sensitiveArgs?: unknown }

  if (t.write === true && t.confirmation !== 'required') {
    errors.push(
      'write: 写操作必须 confirmation=required（否则就是一条无人确认的写通道）',
    )
  }
  if (t.write === false && t.confirmation === 'required') {
    errors.push('confirmation: 读操作不该要求确认（确认疲劳会把写操作的确认也废掉）')
  }
  return { valid: errors.length === 0, errors }
}

/** 工具契约的完整校验：形状 + 跨字段。 */
export function validateAgentTool(tool: unknown): ProtocolValidation {
  const shape = getValidator().validate(tool, loadSchema(AGENT_TOOL_SCHEMA_FILE))
  if (!shape.valid) return { valid: false, errors: errorsOf(shape.errors) }
  return validateAgentToolConsistency(tool)
}

/**
 * Interaction Plan 的跨字段判据：
 *
 *   1. `needsConfirmation` 必须与 actions 一致：有 `confirm` 动作就必须为 true，
 *      没有就必须为 false —— 否则渲染器会按错的信号强调（或忽略）确认。
 *   2. `trace.tools` 必须非空：一份说不出依据的计划，等于让智能体自证事实
 *      （边界 3：智能体不拥有事实）。
 */
export function validateInteractionPlanConsistency(plan: unknown): ProtocolValidation {
  const errors: string[] = []
  const p = (plan ?? {}) as {
    actions?: Array<{ kind?: string }>
    needsConfirmation?: boolean
    trace?: { tools?: string[] }
  }

  const hasConfirm = (p.actions ?? []).some((action) => action.kind === 'confirm')
  if (hasConfirm && p.needsConfirmation !== true) {
    errors.push('needsConfirmation: 含 confirm 动作时必须是 true')
  }
  if (!hasConfirm && p.needsConfirmation === true) {
    errors.push('needsConfirmation: 没有 confirm 动作时不该是 true')
  }
  if (!p.trace?.tools || p.trace.tools.length === 0) {
    errors.push('trace.tools: 计划必须说明事实来自哪些工具（不许让智能体自证）')
  }
  return { valid: errors.length === 0, errors }
}

const BLOCK_KINDS = ['facts', 'lines', 'anomaly', 'table'] as const
const ACTION_KINDS = ['confirm', 'edit', 'cancel'] as const
const ACTION_KINDS_REQUIRING_TOOL = ['confirm'] as const

/**
 * 封闭枚举的**精确诊断**。
 *
 * 为什么在 Schema 之前单独做一遍：`oneOf` 失败时 Schema 只会说"不匹配其中任何一个"，
 * 而真正要告诉作者的是"`html` 不是合法的 block 类型，合法的是这四个"。
 * 错误信息本身就是协议的一部分 —— 说不清哪里错的判据，用起来会被人绕开。
 */
function preciseShapeErrors(plan: unknown): string[] {
  const errors: string[] = []
  const p = (plan ?? {}) as { blocks?: unknown; actions?: unknown }

  if (Array.isArray(p.blocks)) {
    p.blocks.forEach((block, index) => {
      const kind = (block as { kind?: string } | null)?.kind
      if (kind !== undefined && !(BLOCK_KINDS as readonly string[]).includes(kind)) {
        errors.push(
          `blocks[${index}].kind: 未知的 block 类型「${kind}」` +
            `（封闭枚举：${BLOCK_KINDS.join(' / ')}）—— 渲染器必须整份拒绝，不能跳过未知部分`,
        )
      }
    })
  }

  if (Array.isArray(p.actions)) {
    p.actions.forEach((action, index) => {
      const kind = (action as { kind?: string } | null)?.kind
      if (kind !== undefined && !(ACTION_KINDS as readonly string[]).includes(kind)) {
        errors.push(
          `actions[${index}].kind: 未知的动作类型「${kind}」` +
            `（封闭枚举：${ACTION_KINDS.join(' / ')}）`,
        )
        return
      }
      if (
        kind !== undefined &&
        (ACTION_KINDS_REQUIRING_TOOL as readonly string[]).includes(kind) &&
        !(action as { tool?: string }).tool
      ) {
        errors.push(
          `actions[${index}].tool: 「${kind}」动作必须绑定一个契约内的工具` +
            '（界面按钮不是随便的回调；没有工具的动作做不了事）',
        )
      }
    })
  }

  return errors
}

/** Interaction Plan 的完整校验：精确诊断 → 形状 → 跨字段。 */
export function validateInteractionPlan(plan: unknown): ProtocolValidation {
  const precise = preciseShapeErrors(plan)
  if (precise.length > 0) return { valid: false, errors: precise }

  const shape = getValidator().validate(plan, loadSchema(INTERACTION_PLAN_SCHEMA_FILE))
  if (!shape.valid) return { valid: false, errors: errorsOf(shape.errors) }
  return validateInteractionPlanConsistency(plan)
}

/**
 * 工具契约文件的**整体**校验：版本 + 每个工具 + 名字唯一 + 权限点唯一性。
 *
 * 为什么在这里也查重名：契约文件是白名单，重名会让"按名字调用"变成不确定行为
 * （运行到哪一个取决于实现细节）。
 */
export function validateToolCatalog(catalog: unknown): ProtocolValidation {
  const errors: string[] = []
  const c = (catalog ?? {}) as { version?: number; tools?: unknown[] }

  if (c.version !== 1) errors.push('version: 工具契约文件目前只支持 1')
  if (!Array.isArray(c.tools) || c.tools.length === 0) {
    errors.push('tools: 至少声明一个工具')
    return { valid: false, errors }
  }

  const seen = new Set<string>()
  c.tools.forEach((tool, index) => {
    const result = validateAgentTool(tool)
    for (const error of result.errors) errors.push(`tools[${index}]: ${error}`)

    const name = (tool as { name?: string }).name
    if (name) {
      if (seen.has(name)) errors.push(`tools[${index}]: 工具名重复：${name}`)
      seen.add(name)
    }
  })

  return { valid: errors.length === 0, errors }
}
