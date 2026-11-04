// Plan 生成：只从工具结果映射；写工具不执行；空结果仍要合法；未知工具名 fail-closed。
import { loadToolCatalog } from '../agent-tools/contracts-loader'
import { validateInteractionPlan } from './chat-protocol-validator'
import { SURFACE_PATTERN, buildInteractionPlan, surfaceFromToolName } from './interaction-plan-builder'

describe('Interaction Plan 生成', () => {
  const catalog = loadToolCatalog()

  it('读工具结果 → 计划过 validateInteractionPlan', () => {
    const plan = buildInteractionPlan({
      toolName: 'erp_blueprint_list',
      args: {},
      intentLabel: '列出已登记的蓝图包',
      result: [
        { id: 'bp-1', file: 'bp-1.erpkg', manifest: { version: '2026.1.0' } },
      ],
      catalog,
    })
    expect(validateInteractionPlan(plan)).toEqual({ valid: true, errors: [] })
    expect(plan.blocks[0]).toEqual(
      expect.objectContaining({
        kind: 'table',
        columns: ['id', 'file', '版本'],
      }),
    )
  })

  it('写工具 → confirm 绑定该工具 + args，needsConfirmation true（本层不执行）', () => {
    const plan = buildInteractionPlan({
      toolName: 'erp_module_export',
      args: { id: 'e2e-c25-module' },
      intentLabel: '导出模块为最小蓝图包',
      catalog,
    })
    expect(validateInteractionPlan(plan)).toEqual({ valid: true, errors: [] })
    expect(plan.needsConfirmation).toBe(true)
    const confirm = plan.actions.find((action) => action.kind === 'confirm')
    expect(confirm).toEqual(
      expect.objectContaining({
        kind: 'confirm',
        tool: 'erp_module_export',
        args: { id: 'e2e-c25-module' },
      }),
    )
    expect(plan.actions.some((action) => action.kind === 'cancel')).toBe(true)
    expect(plan.title).toBe('把模块 e2e-c25-module 导出为最小蓝图包')
    expect(plan.blocks.some((block) => block.kind === 'facts')).toBe(true)
  })

  it('读工具计划 needsConfirmation false 且带 cancel', () => {
    const plan = buildInteractionPlan({
      toolName: 'erp_module_list',
      args: {},
      intentLabel: '列出当前组织的模块',
      result: [{ id: 'mod-1', name: '库存', version: '1.0.0', status: 'active' }],
      catalog,
    })
    expect(validateInteractionPlan(plan)).toEqual({ valid: true, errors: [] })
    expect(plan.needsConfirmation).toBe(false)
    expect(plan.actions).toEqual([
      expect.objectContaining({ kind: 'cancel', label: '算了' }),
    ])
    expect(plan.actions.some((action) => action.kind === 'confirm')).toBe(false)
  })

  it('空结果（没有蓝图包）→ 仍产出合法计划（blocks 非空）', () => {
    const plan = buildInteractionPlan({
      toolName: 'erp_blueprint_list',
      args: {},
      intentLabel: '列出已登记的蓝图包',
      result: [],
      catalog,
    })
    expect(plan.blocks.length).toBeGreaterThan(0)
    expect(validateInteractionPlan(plan)).toEqual({ valid: true, errors: [] })
    const facts = plan.blocks.find((block) => block.kind === 'facts')
    expect(facts && facts.kind === 'facts' && facts.items[0].value).toMatch(/没有已登记的蓝图包/)
  })

  it('surface 匹配冻结正则（无下划线）', () => {
    expect(surfaceFromToolName('erp_module_export')).toBe('module-export')
    expect(surfaceFromToolName('erp_blueprint_list')).toBe('blueprint-list')
    for (const tool of catalog.tools) {
      const surface = surfaceFromToolName(tool.name)
      expect(surface).toMatch(SURFACE_PATTERN)
      expect(surface).not.toContain('_')
    }
    const plan = buildInteractionPlan({
      toolName: 'erp_blueprint_manifest',
      args: { id: 'bp-1' },
      intentLabel: '查看蓝图包清单',
      result: { blueprint: 'demo', version: '2026.1.0', runtime: '>=1.0.0' },
      catalog,
    })
    expect(plan.surface).toMatch(SURFACE_PATTERN)
    expect(plan.surface).not.toContain('_')
    expect(validateInteractionPlan(plan)).toEqual({ valid: true, errors: [] })
  })

  it('负例：未知工具名 → 抛错，不返回计划', () => {
    expect(() =>
      buildInteractionPlan({
        toolName: 'erp_delete_order',
        args: {},
        intentLabel: '删订单',
        result: [],
        catalog,
      }),
    ).toThrow(/未知工具/)
  })

  it('原子结果超列/超行 → 截断并在 anomaly 说明', () => {
    const columns = Array.from({ length: 13 }, (_, i) => `c${i}`)
    const rows = Array.from({ length: 201 }, (_, r) => columns.map((_, c) => r * 100 + c))
    const plan = buildInteractionPlan({
      toolName: 'erp_atomic_invoke',
      args: { atomicType: 'available-inventory' },
      intentLabel: '运行原子',
      result: { columns, rows },
      catalog,
    })
    expect(validateInteractionPlan(plan)).toEqual({ valid: true, errors: [] })
    const table = plan.blocks.find((block) => block.kind === 'table')
    expect(table && table.kind === 'table' && table.columns).toHaveLength(12)
    expect(table && table.kind === 'table' && table.rows).toHaveLength(200)
    const anomaly = plan.blocks.find((block) => block.kind === 'anomaly')
    expect(anomaly && anomaly.kind === 'anomaly' && anomaly.message).toMatch(/截断/)
  })

  it('编译结果 → facts（嵌套对象 stringify，不塞 undefined）', () => {
    const plan = buildInteractionPlan({
      toolName: 'erp_blueprint_compile',
      args: { id: 'bp-1' },
      intentLabel: '编译蓝图包',
      result: { irDigest: 'sha256:abc', layers: { public: ['semantic.json'] }, missing: undefined },
      catalog,
    })
    expect(validateInteractionPlan(plan)).toEqual({ valid: true, errors: [] })
    const facts = plan.blocks.find((block) => block.kind === 'facts')
    expect(facts && facts.kind === 'facts').toBe(true)
    if (facts && facts.kind === 'facts') {
      expect(facts.items.find((item) => item.label === 'irDigest')?.value).toBe('sha256:abc')
      expect(facts.items.find((item) => item.label === 'layers')?.value).toBe(
        JSON.stringify({ public: ['semantic.json'] }),
      )
      expect(facts.items.some((item) => item.label === 'missing')).toBe(false)
    }
  })
})
