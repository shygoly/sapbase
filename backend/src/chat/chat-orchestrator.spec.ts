// 编排串起来：假 registry。写工具绝不 invoke；匹配不到是 refusal 不是 plan。
import { ForbiddenException } from '@nestjs/common'
import { loadToolCatalog } from '../agent-tools/contracts-loader'
import { ChatOrchestrator } from './chat-orchestrator'
import { validateInteractionPlan } from './chat-protocol-validator'
import type { ChatContext } from './chat.types'
import { RuleBasedIntentParser } from './rule-based-intent-parser'

const CONTEXT: ChatContext = {
  organizationId: 'org-1',
  actor: 'user@example.com',
  grantedPermissions: ['tool:blueprint:read', 'tool:module:export'],
}

function fakeRegistry(overrides?: { invoke?: jest.Mock }) {
  const invoke = overrides?.invoke ?? jest.fn(async () => ({ ok: true, tool: 'erp_blueprint_list', result: [] }))
  return {
    catalog: () => loadToolCatalog(),
    invoke,
  }
}

describe('ChatOrchestrator', () => {
  it('一句话 → 选到工具 → kind: plan 且过 validateInteractionPlan', async () => {
    const invoke = jest.fn(async () => ({
      ok: true,
      tool: 'erp_blueprint_list',
      result: [{ id: 'bp-1', file: 'bp-1.erpkg', manifest: { version: '1.0.0' } }],
    }))
    const orch = new ChatOrchestrator(
      new RuleBasedIntentParser(),
      fakeRegistry({ invoke }) as never,
    )
    const result = await orch.handleMessage('列出已登记的蓝图包', CONTEXT)
    expect(result.kind).toBe('plan')
    if (result.kind !== 'plan') return
    expect(validateInteractionPlan(result.plan)).toEqual({ valid: true, errors: [] })
    expect(result.plan.trace.tools).toEqual(['erp_blueprint_list'])
    expect(invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'erp_blueprint_list',
        args: {},
        organizationId: 'org-1',
        grantedPermissions: CONTEXT.grantedPermissions,
      }),
    )
  })

  it('匹配不到 → kind: refusal 且文案含「没有这个能力」', async () => {
    const invoke = jest.fn()
    const orch = new ChatOrchestrator(
      new RuleBasedIntentParser(),
      fakeRegistry({ invoke }) as never,
    )
    const result = await orch.handleMessage('把订单删了', CONTEXT)
    expect(result).toEqual({ kind: 'refusal', message: expect.stringContaining('没有这个能力') })
    expect(invoke).not.toHaveBeenCalled()
    if (result.kind === 'refusal') {
      expect(result).not.toHaveProperty('plan')
    }
  })

  it('读工具越权 → 按既有错误语义上抛，不吞、不编计划', async () => {
    const invoke = jest.fn(async () => {
      throw new ForbiddenException(
        '缺少权限：tool:blueprint:read（契约声明的权限点必须全部满足）',
      )
    })
    const orch = new ChatOrchestrator(
      new RuleBasedIntentParser(),
      fakeRegistry({ invoke }) as never,
    )
    await expect(orch.handleMessage('列出已登记的蓝图包', CONTEXT)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    await expect(orch.handleMessage('列出已登记的蓝图包', CONTEXT)).rejects.toThrow(/缺少权限/)
  })

  it('写工具在编排层绝不执行', async () => {
    const invoke = jest.fn(async () => {
      throw new Error('写工具不应在编排层被 invoke')
    })
    const orch = new ChatOrchestrator(
      new RuleBasedIntentParser(),
      fakeRegistry({ invoke }) as never,
    )
    const result = await orch.handleMessage('把模块 e2e-c25-module 导出为最小蓝图包', CONTEXT)
    expect(invoke).not.toHaveBeenCalled()
    expect(result.kind).toBe('plan')
    if (result.kind !== 'plan') return
    expect(result.plan.needsConfirmation).toBe(true)
    expect(result.plan.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'confirm',
          tool: 'erp_module_export',
          args: { id: 'e2e-c25-module' },
        }),
        expect.objectContaining({ kind: 'cancel' }),
      ]),
    )
    expect(validateInteractionPlan(result.plan)).toEqual({ valid: true, errors: [] })
  })
})
