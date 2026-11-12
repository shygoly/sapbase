import { ForbiddenException } from '@nestjs/common'
import { AgentToolsController } from './agent-tools.controller'

function setup(options: {
  entitlement?: Record<string, unknown> | null
  quotaError?: Error
} = {}) {
  const registry = {
    invoke: jest.fn(async (input: Record<string, unknown>) => ({
      ok: true,
      tool: input.name,
      result: {},
    })),
    catalog: jest.fn(() => ({ version: 1, tools: [] })),
  }
  const entitlements = {
    findActive: jest.fn(async () => options.entitlement ?? null),
    assertWithinQuota: jest.fn(async () => {
      if (options.quotaError) throw options.quotaError
      return { allowed: true }
    }),
  }
  const usage = { record: jest.fn(async () => ({})) }
  const controller = new AgentToolsController(
    registry as never,
    entitlements as never,
    usage as never,
  )
  return { controller, registry, entitlements, usage }
}

const REQUEST = {
  user: {
    id: 'u1',
    email: 'admin@example.com',
    organizationId: 'org-1',
    permissions: ['tool:blueprint:read'],
  },
  appContext: { appKey: 'erp', appInstallationId: 'app-1' },
}

describe('AgentToolsController entitlement metering', () => {
  it('有有效权益：先查配额，成功后记录本月工具调用', async () => {
    const { controller, registry, entitlements, usage } = setup({
      entitlement: { appKey: 'erp', limits: { maxMonthlyToolCalls: 10 } },
    })
    await expect(
      controller.invoke('erp_blueprint_list', { args: {} }, REQUEST as never),
    ).resolves.toMatchObject({ ok: true })
    expect(entitlements.assertWithinQuota).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        appKey: 'erp',
        metric: 'maxMonthlyToolCalls',
        amount: 1,
      }),
    )
    expect(registry.invoke).toHaveBeenCalled()
    expect(usage.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        appKey: 'erp',
        metric: 'maxMonthlyToolCalls',
        quantity: 1,
      }),
    )
  })

  it('配额超限：不调用工具、不记录用量', async () => {
    const { controller, registry, usage } = setup({
      entitlement: { appKey: 'erp', limits: { maxMonthlyToolCalls: 1 } },
      quotaError: new ForbiddenException('配额已用尽'),
    })
    await expect(
      controller.invoke('erp_blueprint_list', { args: {} }, REQUEST as never),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(registry.invoke).not.toHaveBeenCalled()
    expect(usage.record).not.toHaveBeenCalled()
  })

  it('无权益（迁移期兼容）：照常调用，不计量', async () => {
    const { controller, registry, usage } = setup({ entitlement: null })
    await expect(
      controller.invoke('erp_blueprint_list', { args: {} }, REQUEST as never),
    ).resolves.toMatchObject({ ok: true })
    expect(registry.invoke).toHaveBeenCalled()
    expect(usage.record).not.toHaveBeenCalled()
  })
})
