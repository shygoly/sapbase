/**
 * Interaction Plan 封闭枚举的判定。
 *
 * 真源是仓库根目录 `schemas/interaction-plan.schema.json`（已冻结）。
 * 这里只复述 schema 里的封闭枚举，不要另造一份「看起来像」的清单。
 *
 * 本模块禁止 import React / DOM / 网络。架构方会用 tsc + node 直接跑它。
 */

/** `blocks[].kind` —— 见 `schemas/interaction-plan.schema.json` 的 oneOf 标题 */
export const BLOCK_KINDS = ['facts', 'lines', 'anomaly', 'table'] as const

/** `actions[].kind` —— 见 `schemas/interaction-plan.schema.json` 的 oneOf 标题 */
export const ACTION_KINDS = ['confirm', 'edit', 'cancel'] as const

export type BlockKind = (typeof BLOCK_KINDS)[number]
export type ActionKind = (typeof ACTION_KINDS)[number]

export type PlanDecision =
  | { ok: true }
  | { ok: false; reason: string; unknownKind: string }

export type FactValue = string | number | boolean
export type CellValue = string | number | boolean | null

export type FactsBlock = {
  kind: 'facts'
  items: Array<{ label: string; value: FactValue; source?: string }>
}

export type LinesBlock = {
  kind: 'lines'
  items: Array<{
    label: string
    quantity: number
    unit?: string
    reference?: string
  }>
}

export type AnomalyBlock = {
  kind: 'anomaly'
  severity: 'info' | 'warn' | 'danger'
  message: string
  detail?: string
}

export type TableBlock = {
  kind: 'table'
  columns: string[]
  rows: CellValue[][]
}

export type PlanBlock = FactsBlock | LinesBlock | AnomalyBlock | TableBlock

export type ConfirmAction = {
  kind: 'confirm'
  id: string
  label: string
  tool: string
  args?: Record<string, unknown>
}

export type EditAction = {
  kind: 'edit'
  id: string
  label: string
  fields: string[]
}

export type CancelAction = {
  kind: 'cancel'
  id: string
  label: string
}

export type PlanAction = ConfirmAction | EditAction | CancelAction

export type InteractionPlan = {
  plan: 'interaction-plan/v1'
  surface: string
  title: string
  blocks: PlanBlock[]
  actions: PlanAction[]
  trace: { tools: string[]; intent?: string }
  needsConfirmation: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function kindOf(value: unknown): string {
  if (!isRecord(value)) return '(missing)'
  const kind = value.kind
  if (kind === undefined || kind === null || kind === '') return '(missing)'
  return String(kind)
}

function isBlockKind(value: string): value is BlockKind {
  return (BLOCK_KINDS as readonly string[]).includes(value)
}

function isActionKind(value: string): value is ActionKind {
  return (ACTION_KINDS as readonly string[]).includes(value)
}

/**
 * 渲染器的准入闸：任一未知 kind / 缺 tool 的 confirm → 整份拒绝。
 * 跳过不认识的部分等于让智能体悄悄决定哪些内容不展示。
 */
export function decidePlanRenderable(plan: unknown): PlanDecision {
  if (!isRecord(plan)) {
    return {
      ok: false,
      reason: 'plan 必须是对象（interaction-plan/v1）',
      unknownKind: '(not-object)',
    }
  }

  if (!Array.isArray(plan.blocks)) {
    return {
      ok: false,
      reason: 'plan.blocks 必须是数组',
      unknownKind: '(blocks)',
    }
  }

  if (!Array.isArray(plan.actions)) {
    return {
      ok: false,
      reason: 'plan.actions 必须是数组',
      unknownKind: '(actions)',
    }
  }

  for (const block of plan.blocks) {
    const kind = kindOf(block)
    if (!isBlockKind(kind)) {
      return {
        ok: false,
        reason:
          `未知的 block 类型「${kind}」` +
          `（封闭枚举：${BLOCK_KINDS.join(' / ')}）—— 渲染器必须整份拒绝，不能跳过未知部分`,
        unknownKind: kind,
      }
    }
  }

  for (const action of plan.actions) {
    const kind = kindOf(action)
    if (!isActionKind(kind)) {
      return {
        ok: false,
        reason:
          `未知的动作类型「${kind}」` +
          `（封闭枚举：${ACTION_KINDS.join(' / ')}）—— 渲染器必须整份拒绝，不能跳过未知部分`,
        unknownKind: kind,
      }
    }

    if (kind === 'confirm') {
      const tool = isRecord(action) ? action.tool : undefined
      if (typeof tool !== 'string' || tool.trim().length === 0) {
        return {
          ok: false,
          reason:
            'confirm 动作必须绑定一个契约内的工具（界面按钮不是随便的回调）',
          unknownKind: 'confirm',
        }
      }
    }
  }

  return { ok: true }
}
