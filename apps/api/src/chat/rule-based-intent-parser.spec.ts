// 确定性意图解析：中文说法 → 工具 + args；抽不到必需参数 → null，不许猜 id。
import { ForbiddenException } from '@nestjs/common'
import { loadToolCatalog } from '../agent-tools/contracts-loader'
import type { ChatContext } from './chat.types'
import { INTENT_RULES } from './intent-rules'
import { RuleBasedIntentParser } from './rule-based-intent-parser'

const CONTEXT: ChatContext = {
  organizationId: 'org-1',
  actor: 'user@example.com',
  grantedPermissions: ['tool:blueprint:read'],
}

function parser(): RuleBasedIntentParser {
  return new RuleBasedIntentParser()
}

describe('RuleBasedIntentParser', () => {
  it('构造时用真契约校验规则表（指向不存在的工具即抛）', () => {
    expect(() => new RuleBasedIntentParser(INTENT_RULES, loadToolCatalog())).not.toThrow()
    expect(
      () =>
        new RuleBasedIntentParser(
          [{ id: 'ghost', tool: 'erp_not_a_tool', label: 'x', tryMatch: () => ({}) }],
          loadToolCatalog(),
        ),
    ).toThrow(/不存在的工具/)
  })

  it.each([
    ['列出已登记的蓝图包', 'blueprint.list', 'erp_blueprint_list', {}],
    ['有哪些蓝图包', 'blueprint.list', 'erp_blueprint_list', {}],
    ['看一下 id=demo-pack 的清单', 'blueprint.manifest', 'erp_blueprint_manifest', { id: 'demo-pack' }],
    ['看「bp-1」的清单', 'blueprint.manifest', 'erp_blueprint_manifest', { id: 'bp-1' }],
    ['编译叫 demo-pack 的包', 'blueprint.compile', 'erp_blueprint_compile', { id: 'demo-pack' }],
    ['跑一下原子 available-inventory', 'atomic.invoke', 'erp_atomic_invoke', { atomicType: 'available-inventory' }],
    ['调用原子「available-inventory」', 'atomic.invoke', 'erp_atomic_invoke', { atomicType: 'available-inventory' }],
    ['列出模块', 'module.list', 'erp_module_list', {}],
    ['把模块 e2e-c25-module 导出为最小蓝图包', 'module.export', 'erp_module_export', { id: 'e2e-c25-module' }],
    ['把叫 e2e-c25-module 的模块导出', 'module.export', 'erp_module_export', { id: 'e2e-c25-module' }],
  ] as const)('中文「%s」→ %s / %s', async (message, id, tool, args) => {
    const intent = await parser().parse({ message, context: CONTEXT })
    expect(intent).toEqual(expect.objectContaining({ id, tool, args }))
    expect(intent?.label.length).toBeGreaterThan(0)
  })

  it('负例：清单说法没有 id → 返回 null，不许猜', async () => {
    const intent = await parser().parse({
      message: '看一下那个包的清单',
      context: CONTEXT,
    })
    expect(intent).toBeNull()
  })

  it('负例：没有这个能力的说法 → null（不编工具）', async () => {
    await expect(
      parser().parse({ message: '把订单删了', context: CONTEXT }),
    ).resolves.toBeNull()
    await expect(
      parser().parse({ message: '请帮我处理一下', context: CONTEXT }),
    ).resolves.toBeNull()
  })

  it('不读 context 里的权限来决定匹不匹配（权限是 registry 的事）', async () => {
    const intent = await parser().parse({
      message: '列出已登记的蓝图包',
      context: { ...CONTEXT, grantedPermissions: [] },
    })
    expect(intent?.tool).toBe('erp_blueprint_list')
    expect(ForbiddenException).toBeDefined()
  })
})
