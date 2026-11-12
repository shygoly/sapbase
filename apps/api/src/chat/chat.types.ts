/**
 * 编排层的接缝类型。LLM 适配器以后挂在 IntentParser 后面，
 * 不要改编排器；本轮只有确定性实现。
 */
import type { BusinessAppExecutionContext } from '@speckit/shared-schemas'
import type { Budget } from '@sap/agent-kernel'

export const INTENT_PARSER = Symbol('INTENT_PARSER')

export interface ChatContext {
  organizationId?: string
  actor: string
  grantedPermissions: readonly string[]
  appContext?: BusinessAppExecutionContext
  /** 服务端预算；缺省由 kernel 默认值兜底，调用方不能放大上限。 */
  budget?: Budget
}

export interface Intent {
  id: string
  tool: string
  args: Record<string, unknown>
  label: string
}

export interface IntentParser {
  parse(input: { message: string; context: ChatContext }): Promise<Intent | null>
}

export type FactValue = string | number | boolean
export type CellValue = string | number | boolean | null

export type PlanBlock =
  | { kind: 'facts'; items: Array<{ label: string; value: FactValue; source?: string }> }
  | { kind: 'lines'; items: Array<{ label: string; quantity: number; unit?: string; reference?: string }> }
  | { kind: 'anomaly'; severity: 'info' | 'warn' | 'danger'; message: string; detail?: string }
  | { kind: 'table'; columns: string[]; rows: CellValue[][] }

export type PlanAction =
  | { kind: 'confirm'; id: string; label: string; tool: string; args?: Record<string, unknown> }
  | { kind: 'edit'; id: string; label: string; fields: string[] }
  | { kind: 'cancel'; id: string; label: string }

export interface InteractionPlan {
  plan: 'interaction-plan/v1'
  surface: string
  title: string
  blocks: PlanBlock[]
  actions: PlanAction[]
  trace: { tools: string[]; intent?: string }
  needsConfirmation: boolean
}

export type ChatResult =
  | { kind: 'plan'; plan: InteractionPlan; intent: string; modelId?: string }
  | { kind: 'refusal'; message: string; intent?: string; modelId?: string }
