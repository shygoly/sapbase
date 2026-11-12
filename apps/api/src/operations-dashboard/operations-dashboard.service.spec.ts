import { BadRequestException } from '@nestjs/common'
import { OperationsDashboardService } from './operations-dashboard.service'

function setup() {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('GROUP BY action')) {
      return [
        { action: 'business_app.install', count: 3 },
        { action: 'business_app.upgrade', count: 1 },
      ]
    }
    if (sql.includes('ORDER BY timestamp DESC')) {
      return [
        {
          id: 'a1',
          action: 'business_app.install',
          resource: 'business_app',
          status: 'success',
          actor: 'admin@example.com',
          timestamp: '2026-11-12T10:00:00.000Z',
        },
      ]
    }
    if (sql.includes("status = 'completed'")) {
      return [{ total: 10, completed: 9, p95: 1200 }]
    }
    if (sql.includes("status = 'success'")) {
      return [{ total: 20, success: 19, p95: 300 }]
    }
    if (sql.includes("status <> 'removed'")) {
      return [{ total: 4, active: 4 }]
    }
    if (sql.includes('GROUP BY 1')) {
      return [
        { modelId: 'deepseek-chat', tokensIn: 1000, tokensOut: 2000 },
        { modelId: 'deepseek-reasoner', tokensIn: 500, tokensOut: 500 },
      ]
    }
    if (sql.includes('FROM public.app_usage_records')) {
      return [
        { metric: 'maxMonthlyAgentRuns', quantity: '3' },
        { metric: 'maxMonthlyToolCalls', quantity: '7.5' },
      ]
    }
    if (sql.includes('taintSource')) {
      return [
        {
          id: 'turn-1',
          status: 'failed',
          detail: 'tool:erp_blueprint_list',
          createdAt: '2026-11-12T11:00:00.000Z',
        },
      ]
    }
    if (sql.includes('errorCode')) {
      return [
        {
          id: 'call-1',
          status: 'failure',
          detail: 'forbidden',
          createdAt: '2026-11-12T12:00:00.000Z',
        },
      ]
    }
    if (sql.includes('"appKey"')) {
      return [
        {
          id: 'app-1',
          status: 'suspended',
          detail: 'crm',
          createdAt: '2026-11-12T09:00:00.000Z',
        },
      ]
    }
    if (sql.includes("status IN ('failed', 'cancelled')")) {
      return [{ count: 2 }]
    }
    if (sql.includes("status = 'failure'")) {
      return [{ count: 3 }]
    }
    if (sql.includes("status IN ('failed', 'suspended')")) {
      return [{ count: 1 }]
    }
    return []
  })
  const service = new OperationsDashboardService({ query } as never)
  return { service, query }
}

describe('OperationsDashboardService', () => {
  it('聚合 audit/SLO/成本/失败四类面板', async () => {
    const { service } = setup()
    const result = await service.getDashboard('org-1', 24)
    expect(result.window.hours).toBe(24)
    expect(result.audit).toMatchObject({
      total: 4,
      byAction: [
        { action: 'business_app.install', count: 3 },
        { action: 'business_app.upgrade', count: 1 },
      ],
    })
    expect(result.audit.recent[0]).toMatchObject({
      id: 'a1',
      action: 'business_app.install',
    })

    expect(result.slo.agent).toMatchObject({
      total: 10,
      successRate: 0.9,
      p95LatencyMs: 1200,
    })
    expect(result.slo.tools).toMatchObject({
      total: 20,
      successRate: 0.95,
      p95LatencyMs: 300,
    })
    expect(result.slo.installations).toMatchObject({ total: 4, availability: 1 })
    expect(result.slo.met).toMatchObject({
      agentSuccessRate: false,
      toolSuccessRate: false,
      agentP95LatencyMs: true,
      toolP95LatencyMs: true,
      installationAvailability: true,
    })

    expect(result.cost.tokensIn).toBe(1500)
    expect(result.cost.tokensOut).toBe(2500)
    expect(result.cost.byModel).toHaveLength(2)
    expect(result.cost.usage).toEqual([
      { metric: 'maxMonthlyAgentRuns', quantity: 3 },
      { metric: 'maxMonthlyToolCalls', quantity: 7.5 },
    ])
    expect(result.failures).toMatchObject({
      agentTurns: 2,
      toolCalls: 3,
      installations: 1,
    })
    expect(result.failures.recent.map((item) => item.kind)).toEqual([
      'tool_call',
      'agent_turn',
      'installation',
    ])
  })

  it('无样本时比率按 1 处理，避免空组织误报 SLO', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('FROM public.agent_turns') && sql.includes('COUNT(*)::int AS total')) {
        return [{ total: 0, completed: 0, p95: 0 }]
      }
      if (sql.includes('FROM public.agent_tool_calls') && sql.includes('COUNT(*)::int AS total')) {
        return [{ total: 0, success: 0, p95: 0 }]
      }
      if (sql.includes("status <> 'removed'")) return [{ total: 0, active: 0 }]
      return []
    })
    const service = new OperationsDashboardService({ query } as never)
    const result = await service.getDashboard('org-1', 1)
    expect(result.slo.agent.successRate).toBe(1)
    expect(result.slo.tools.successRate).toBe(1)
    expect(result.slo.installations.availability).toBe(1)
    expect(result.slo.met.agentSuccessRate).toBe(true)
  })

  it('非法 hours 拒绝', async () => {
    const { service } = setup()
    await expect(service.getDashboard('org-1', 0)).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await expect(service.getDashboard('org-1', 721)).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await expect(service.getDashboard('', 24)).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })
})
