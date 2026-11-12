import { BadRequestException, Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'

export interface OperationsDashboardWindow {
  from: string
  to: string
  hours: number
}

export interface AuditPanel {
  total: number
  byAction: Array<{ action: string; count: number }>
  recent: Array<{
    id: string
    action: string
    resource: string
    status: string
    actor: string
    timestamp: string
  }>
}

export interface SloPanel {
  agent: { total: number; successRate: number; p95LatencyMs: number }
  tools: { total: number; successRate: number; p95LatencyMs: number }
  installations: { total: number; availability: number }
  targets: {
    agentSuccessRate: number
    toolSuccessRate: number
    agentP95LatencyMs: number
    toolP95LatencyMs: number
    installationAvailability: number
  }
  met: {
    agentSuccessRate: boolean
    toolSuccessRate: boolean
    agentP95LatencyMs: boolean
    toolP95LatencyMs: boolean
    installationAvailability: boolean
  }
}

export interface CostPanel {
  tokensIn: number
  tokensOut: number
  estimatedCostUsd: number
  byModel: Array<{
    modelId: string
    tokensIn: number
    tokensOut: number
    estimatedCostUsd: number
  }>
  usage: Array<{ metric: string; quantity: number }>
}

export interface FailurePanel {
  agentTurns: number
  toolCalls: number
  installations: number
  recent: Array<{
    kind: 'agent_turn' | 'tool_call' | 'installation'
    id: string
    status: string
    detail: string | null
    createdAt: string
  }>
}

export interface OperationsDashboard {
  generatedAt: string
  window: OperationsDashboardWindow
  audit: AuditPanel
  slo: SloPanel
  cost: CostPanel
  failures: FailurePanel
}

const SLO_TARGETS = {
  agentSuccessRate: 0.95,
  toolSuccessRate: 0.99,
  agentP95LatencyMs: 5_000,
  toolP95LatencyMs: 2_000,
  installationAvailability: 0.99,
} as const

/**
 * 安装与 Agent 运行的运维看板（6.6）。
 *
 * 只读聚合既有真源：`audit_logs`、`agent_turns`、`agent_tool_calls`、
 * `app_installations`、`app_usage_records`；不新增第二套事实表。
 * 成本按 token 用量和可配置单价估算，不替代账单真源。
 */
@Injectable()
export class OperationsDashboardService {
  constructor(private readonly dataSource: DataSource) {}

  async getDashboard(
    organizationId: string,
    hours = 24,
  ): Promise<OperationsDashboard> {
    if (!organizationId) throw new BadRequestException('缺少组织上下文')
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 30) {
      throw new BadRequestException('hours 必须在 1–720 之间')
    }
    const to = new Date()
    const from = new Date(to.getTime() - hours * 60 * 60 * 1000)
    const [audit, slo, cost, failures] = await Promise.all([
      this.auditPanel(organizationId, hours),
      this.sloPanel(organizationId, hours),
      this.costPanel(organizationId, hours),
      this.failurePanel(organizationId, hours),
    ])
    return {
      generatedAt: to.toISOString(),
      window: { from: from.toISOString(), to: to.toISOString(), hours },
      audit,
      slo,
      cost,
      failures,
    }
  }

  private async auditPanel(organizationId: string, hours: number): Promise<AuditPanel> {
    const byAction = (await this.dataSource.query(
      `SELECT action, COUNT(*)::int AS count
         FROM public.audit_logs
        WHERE "organizationId" = $1
          AND timestamp >= now() - make_interval(hours => $2::int)
          AND (action LIKE 'business_app.%' OR action LIKE 'agent.%')
        GROUP BY action
        ORDER BY count DESC, action ASC
        LIMIT 20`,
      [organizationId, hours],
    )) as Array<{ action: string; count: number | string }>
    const recent = (await this.dataSource.query(
      `SELECT id, action, resource, status, actor, timestamp
         FROM public.audit_logs
        WHERE "organizationId" = $1
          AND timestamp >= now() - make_interval(hours => $2::int)
          AND (action LIKE 'business_app.%' OR action LIKE 'agent.%')
        ORDER BY timestamp DESC
        LIMIT 20`,
      [organizationId, hours],
    )) as Array<Record<string, unknown>>
    return {
      total: byAction.reduce((sum, row) => sum + Number(row.count ?? 0), 0),
      byAction: byAction.map((row) => ({
        action: row.action,
        count: Number(row.count ?? 0),
      })),
      recent: recent.map((row) => ({
        id: String(row.id),
        action: String(row.action),
        resource: String(row.resource),
        status: String(row.status),
        actor: String(row.actor),
        timestamp: new Date(row.timestamp as string).toISOString(),
      })),
    }
  }

  private async sloPanel(organizationId: string, hours: number): Promise<SloPanel> {
    const agentRows = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
              COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY "latencyMs"), 0) AS p95
         FROM public.agent_turns
        WHERE "organizationId" = $1
          AND "createdAt" >= now() - make_interval(hours => $2::int)`,
      [organizationId, hours],
    )) as Array<Record<string, unknown>>
    const toolRows = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'success')::int AS success,
              COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY "latencyMs"), 0) AS p95
         FROM public.agent_tool_calls
        WHERE "organizationId" = $1
          AND "createdAt" >= now() - make_interval(hours => $2::int)`,
      [organizationId, hours],
    )) as Array<Record<string, unknown>>
    const installationRows = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'active')::int AS active
         FROM public.app_installations
        WHERE "organizationId" = $1 AND status <> 'removed'`,
      [organizationId],
    )) as Array<Record<string, unknown>>

    const agent = agentRows[0] ?? {}
    const tools = toolRows[0] ?? {}
    const installations = installationRows[0] ?? {}
    const agentTotal = Number(agent.total ?? 0)
    const agentCompleted = Number(agent.completed ?? 0)
    const toolTotal = Number(tools.total ?? 0)
    const toolSuccess = Number(tools.success ?? 0)
    const installationTotal = Number(installations.total ?? 0)
    const installationActive = Number(installations.active ?? 0)
    const agentSuccessRate = ratio(agentCompleted, agentTotal)
    const toolSuccessRate = ratio(toolSuccess, toolTotal)
    const installationAvailability = ratio(installationActive, installationTotal)
    const agentP95 = Number(agent.p95 ?? 0)
    const toolP95 = Number(tools.p95 ?? 0)
    return {
      agent: { total: agentTotal, successRate: agentSuccessRate, p95LatencyMs: agentP95 },
      tools: { total: toolTotal, successRate: toolSuccessRate, p95LatencyMs: toolP95 },
      installations: { total: installationTotal, availability: installationAvailability },
      targets: { ...SLO_TARGETS },
      met: {
        agentSuccessRate: agentSuccessRate >= SLO_TARGETS.agentSuccessRate,
        toolSuccessRate: toolSuccessRate >= SLO_TARGETS.toolSuccessRate,
        agentP95LatencyMs: agentP95 <= SLO_TARGETS.agentP95LatencyMs,
        toolP95LatencyMs: toolP95 <= SLO_TARGETS.toolP95LatencyMs,
        installationAvailability:
          installationAvailability >= SLO_TARGETS.installationAvailability,
      },
    }
  }

  private async costPanel(organizationId: string, hours: number): Promise<CostPanel> {
    const byModelRows = (await this.dataSource.query(
      `SELECT COALESCE("modelId", '(default)') AS "modelId",
              COALESCE(SUM("tokensIn"), 0)::bigint AS "tokensIn",
              COALESCE(SUM("tokensOut"), 0)::bigint AS "tokensOut"
         FROM public.agent_turns
        WHERE "organizationId" = $1
          AND "createdAt" >= now() - make_interval(hours => $2::int)
        GROUP BY 1
        ORDER BY "tokensIn" DESC`,
      [organizationId, hours],
    )) as Array<Record<string, unknown>>
    const usageRows = (await this.dataSource.query(
      `SELECT metric, COALESCE(SUM(quantity), 0) AS quantity
         FROM public.app_usage_records
        WHERE "organizationId" = $1
          AND "periodStart" = date_trunc('month', now())
        GROUP BY metric
        ORDER BY metric ASC`,
      [organizationId],
    )) as Array<Record<string, unknown>>
    const inputRate = numberEnv('AGENT_COST_INPUT_PER_1K', 0.001)
    const outputRate = numberEnv('AGENT_COST_OUTPUT_PER_1K', 0.002)
    const byModel = byModelRows.map((row) => {
      const tokensIn = Number(row.tokensIn ?? 0)
      const tokensOut = Number(row.tokensOut ?? 0)
      return {
        modelId: String(row.modelId),
        tokensIn,
        tokensOut,
        estimatedCostUsd:
          (tokensIn / 1000) * inputRate + (tokensOut / 1000) * outputRate,
      }
    })
    return {
      tokensIn: byModel.reduce((sum, row) => sum + row.tokensIn, 0),
      tokensOut: byModel.reduce((sum, row) => sum + row.tokensOut, 0),
      estimatedCostUsd: byModel.reduce((sum, row) => sum + row.estimatedCostUsd, 0),
      byModel,
      usage: usageRows.map((row) => ({
        metric: String(row.metric),
        quantity: Number(row.quantity ?? 0),
      })),
    }
  }

  private async failurePanel(organizationId: string, hours: number): Promise<FailurePanel> {
    const agentRows = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
         FROM public.agent_turns
        WHERE "organizationId" = $1
          AND "createdAt" >= now() - make_interval(hours => $2::int)
          AND status IN ('failed', 'cancelled')`,
      [organizationId, hours],
    )) as Array<Record<string, unknown>>
    const toolRows = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
         FROM public.agent_tool_calls
        WHERE "organizationId" = $1
          AND "createdAt" >= now() - make_interval(hours => $2::int)
          AND status = 'failure'`,
      [organizationId, hours],
    )) as Array<Record<string, unknown>>
    const installationRows = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
         FROM public.app_installations
        WHERE "organizationId" = $1 AND status IN ('failed', 'suspended')`,
      [organizationId],
    )) as Array<Record<string, unknown>>
    const agentRecent = (await this.dataSource.query(
      `SELECT id, status, COALESCE("taintSource", NULL) AS detail, "createdAt"
         FROM public.agent_turns
        WHERE "organizationId" = $1
          AND "createdAt" >= now() - make_interval(hours => $2::int)
          AND status IN ('failed', 'cancelled')
        ORDER BY "createdAt" DESC
        LIMIT 10`,
      [organizationId, hours],
    )) as Array<Record<string, unknown>>
    const toolRecent = (await this.dataSource.query(
      `SELECT id, status, COALESCE("errorCode", tool) AS detail, "createdAt"
         FROM public.agent_tool_calls
        WHERE "organizationId" = $1
          AND "createdAt" >= now() - make_interval(hours => $2::int)
          AND status = 'failure'
        ORDER BY "createdAt" DESC
        LIMIT 10`,
      [organizationId, hours],
    )) as Array<Record<string, unknown>>
    const installationRecent = (await this.dataSource.query(
      `SELECT id, status, "appKey" AS detail, "updatedAt" AS "createdAt"
         FROM public.app_installations
        WHERE "organizationId" = $1 AND status IN ('failed', 'suspended')
        ORDER BY "updatedAt" DESC
        LIMIT 10`,
      [organizationId],
    )) as Array<Record<string, unknown>>
    const recent = [
      ...agentRecent.map((row) => ({
        kind: 'agent_turn' as const,
        id: String(row.id),
        status: String(row.status),
        detail: row.detail === null ? null : String(row.detail),
        createdAt: new Date(row.createdAt as string).toISOString(),
      })),
      ...toolRecent.map((row) => ({
        kind: 'tool_call' as const,
        id: String(row.id),
        status: String(row.status),
        detail: row.detail === null ? null : String(row.detail),
        createdAt: new Date(row.createdAt as string).toISOString(),
      })),
      ...installationRecent.map((row) => ({
        kind: 'installation' as const,
        id: String(row.id),
        status: String(row.status),
        detail: row.detail === null ? null : String(row.detail),
        createdAt: new Date(row.createdAt as string).toISOString(),
      })),
    ]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 20)
    return {
      agentTurns: Number(agentRows[0]?.count ?? 0),
      toolCalls: Number(toolRows[0]?.count ?? 0),
      installations: Number(installationRows[0]?.count ?? 0),
      recent,
    }
  }
}

function ratio(numerator: number, denominator: number): number {
  if (!denominator) return 1
  return Math.max(0, Math.min(1, numerator / denominator))
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}
