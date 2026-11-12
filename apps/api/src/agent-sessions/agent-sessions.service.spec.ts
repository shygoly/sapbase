import { BudgetGuard, compileContextEnvelope, wrapUntrustedData } from '@sap/agent-kernel'

describe('agent-sessions contract', () => {
  it('compiles a release-bound envelope and excludes unauthorized tools', () => {
    const envelope = compileContextEnvelope({
      turnId: 'turn-1',
      user: { id: 'u1', roles: ['buyer'] },
      org: { id: 'o1' },
      app: {
        appKey: 'erp-purchase',
        installationId: 'ins-1',
        releaseId: 'rel-1',
        releaseVersion: '1.4.0',
        channel: 'stable',
      },
      permissions: ['tool:order:read'],
      tools: [
        { name: 'erp_order_get', description: 'read', write: false, confirmation: 'none', permission: 'tool:order:read' },
        { name: 'erp_order_create', description: 'write', write: true, confirmation: 'required', permission: 'tool:order:write' },
      ],
    })
    expect(envelope.app?.releaseId).toBe('rel-1')
    expect(envelope.tools.map((tool) => tool.name)).toEqual(['erp_order_get'])
  })

  it('wraps untrusted data and enforces budget', () => {
    expect(wrapUntrustedData({ content: 'x', source: 'feedback', nonce: 'n' })).toContain('nonce="n"')
    const guard = new BudgetGuard({ maxToolCalls: 1, maxTokens: 10, deadlineMs: 100 })
    guard.recordToolCall()
    expect(() => guard.recordToolCall()).toThrow('BUDGET_EXCEEDED')
  })

  it('over-budget runs：token 与 deadline 超限拒绝', () => {
    const tokens = new BudgetGuard({ maxToolCalls: 10, maxTokens: 10, deadlineMs: 1000 })
    expect(() => tokens.recordTokens(11)).toThrow('BUDGET_EXCEEDED:tokens')
    const deadline = new BudgetGuard({ maxToolCalls: 10, maxTokens: 10, deadlineMs: -1 })
    expect(() => deadline.assertDeadline()).toThrow('BUDGET_EXCEEDED:deadline')
  })
})

import { AgentSessionsService } from './agent-sessions.service'

describe('AgentSessionsService taint', () => {
  it('marks a turn tainted with source and org scoping', async () => {
    const update = jest.fn(async () => ({ affected: 1 }))
    const service = new AgentSessionsService(
      {} as never,
      { update } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    )
    await expect(service.markTurnTainted('turn-1', 'org-1', 'feedback')).resolves.toBe(true)
    expect(update).toHaveBeenCalledWith(
      { id: 'turn-1', organizationId: 'org-1' },
      { tainted: true, taintSource: 'feedback' },
    )
  })
})

describe('AgentSessionsService run policy', () => {
  function setup(options: { existingTurn?: any; cancelled?: boolean; orchestratorError?: Error } = {}) {
    const conversation = {
      id: 'conv-1',
      organizationId: 'org-1',
      userId: 'u1',
      appKey: 'default',
      lastTurnAt: new Date(),
    }
    const savedTurns: any[] = []
    let turnSeq = 1
    const turns = {
      findOne: jest.fn(async (query: any) => {
        if (query?.where?.idempotencyKey) return options.existingTurn ?? null
        if (options.cancelled) {
          return { id: savedTurns[0]?.id ?? 'turn-1', organizationId: 'org-1', status: 'cancelled' }
        }
        return { id: savedTurns[0]?.id ?? 'turn-1', organizationId: 'org-1', status: 'running' }
      }),
      create: jest.fn((row: any) => ({ id: `turn-${turnSeq++}`, ...row })),
      save: jest.fn(async (row: any) => {
        const index = savedTurns.findIndex((item) => item.id === row.id)
        if (index >= 0) savedTurns[index] = row
        else savedTurns.push(row)
        return row
      }),
    }
    const conversations = {
      findOne: jest.fn(async () => conversation),
      save: jest.fn(async (row: any) => row),
      create: jest.fn((row: any) => ({ id: 'conv-1', ...row })),
    }
    const orchestrator = {
      handleMessage: jest.fn(async () => {
        if (options.orchestratorError) throw options.orchestratorError
        return { kind: 'refusal', message: '没有这个能力' }
      }),
    }
    const cache = {
      recentTurn: jest.fn(async () => ({ events: [{ type: 'turn.end', data: { cached: true } }] })),
      rememberTurn: jest.fn(async () => undefined),
      remember: jest.fn(async () => undefined),
    }
    const service = new AgentSessionsService(
      conversations as never,
      turns as never,
      { save: jest.fn(), create: jest.fn((row: any) => row) } as never,
      { catalog: jest.fn(() => ({ tools: [] })) } as never,
      orchestrator as never,
      {} as never,
      { listPublished: jest.fn(async () => []) } as never,
      cache as never,
    )
    return { service, turns, conversations, orchestrator, cache, savedTurns }
  }

  it('idempotencyKey 命中已有 turn：不重跑编排，返回缓存事件', async () => {
    const { service, orchestrator, cache } = setup({
      existingTurn: {
        id: 'turn-existing',
        conversationId: 'conv-1',
        organizationId: 'org-1',
        status: 'completed',
      },
    })
    const result = await service.chat({
      organizationId: 'org-1',
      userId: 'u1',
      actor: 'u1',
      permissions: [],
      message: 'hello',
      idempotencyKey: 'same-key',
    })
    expect(result).toMatchObject({
      conversationId: 'conv-1',
      turnId: 'turn-existing',
      status: 'completed',
      idempotent: true,
    })
    expect(orchestrator.handleMessage).not.toHaveBeenCalled()
    expect(cache.recentTurn).toHaveBeenCalledWith('turn-existing')
  })

  it('运行前 turn 已取消：不调用编排，返回 cancelled 事件', async () => {
    const { service, orchestrator, savedTurns } = setup({ cancelled: true })
    const result = await service.chat({
      organizationId: 'org-1',
      userId: 'u1',
      actor: 'u1',
      permissions: [],
      message: 'hello',
      conversationId: 'conv-1',
    })
    expect(result).toMatchObject({ conversationId: 'conv-1', cancelled: true })
    expect(orchestrator.handleMessage).not.toHaveBeenCalled()
    expect(savedTurns.at(-1)?.status).toBe('cancelled')
  })

  it('编排抛出预算超限：turn 标记 failed，事件返回明确错误', async () => {
    const { service, savedTurns } = setup({
      orchestratorError: new Error('BUDGET_EXCEEDED:toolCalls'),
    })
    const result = await service.chat({
      organizationId: 'org-1',
      userId: 'u1',
      actor: 'u1',
      permissions: [],
      message: 'hello',
      conversationId: 'conv-1',
    })
    expect(savedTurns.at(-1)?.status).toBe('failed')
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'error',
          data: expect.objectContaining({ message: 'BUDGET_EXCEEDED:toolCalls' }),
        }),
      ]),
    )
  })

  it('编排收到服务端预算，调用方不能放大上限', async () => {
    const { service, orchestrator } = setup()
    await service.chat({
      organizationId: 'org-1',
      userId: 'u1',
      actor: 'u1',
      permissions: [],
      message: 'hello',
      conversationId: 'conv-1',
    })
    expect(orchestrator.handleMessage).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({
        budget: {
          maxToolCalls: 8,
          maxTokens: 12_000,
          deadlineMs: 30_000,
        },
      }),
    )
  })
})
