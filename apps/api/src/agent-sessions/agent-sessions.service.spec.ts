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
