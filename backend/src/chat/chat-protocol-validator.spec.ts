// chat-first 的两份协议：形状 + 跨字段判据。
// 负例是重点 —— 这两份协议是"智能体能做什么"的边界，放过一条就等于开了一条通道。
import {
  validateAgentTool,
  validateInteractionPlan,
  validateToolCatalog,
} from './chat-protocol-validator'

const VALID_TOOL = {
  name: 'erp_blueprint_list',
  description: '列出蓝图包（看这个企业有哪些业务定义）',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  permission: 'tool:blueprint:read',
  write: false,
  confirmation: 'none',
}

const WRITE_TOOL = {
  name: 'erp_module_export',
  description: '把模块导出为最小蓝图包',
  parameters: { type: 'object', properties: { moduleId: { type: 'string' } } },
  permission: 'tool:module:write',
  write: true,
  confirmation: 'required',
}

const VALID_PLAN = {
  plan: 'interaction-plan/v1',
  surface: 'purchase-order-draft',
  title: '给宁波华兴下 50 万铜材采购单',
  blocks: [
    { kind: 'facts', items: [{ label: '供应商', value: '宁波华兴' }] },
    { kind: 'anomaly', severity: 'warn', message: '本次价格比上次高 8.7%' },
  ],
  actions: [
    { kind: 'confirm', id: 'confirm', label: '确认下单', tool: 'erp_purchase_order_create' },
    { kind: 'cancel', id: 'cancel', label: '算了' },
  ],
  trace: { tools: ['erp_atomic_invoke:available-inventory'], intent: '下采购单' },
  needsConfirmation: true,
}

describe('工具契约', () => {
  it('接受一个读工具', () => {
    expect(validateAgentTool(VALID_TOOL)).toEqual({ valid: true, errors: [] })
  })

  it('接受一个写工具（要求确认）', () => {
    expect(validateAgentTool(WRITE_TOOL)).toEqual({ valid: true, errors: [] })
  })

  it.each([
    ['缺 name', { ...VALID_TOOL, name: undefined }, 'name'],
    ['name 不是 snake_case', { ...VALID_TOOL, name: 'ErpBlueprintList' }, 'name'],
    ['缺权限点', { ...VALID_TOOL, permission: undefined }, 'permission'],
    ['权限点格式不对', { ...VALID_TOOL, permission: 'blueprint.read' }, 'permission'],
    ['缺是否写数据', { ...VALID_TOOL, write: undefined }, 'write'],
    ['未知字段（契约是封闭的）', { ...VALID_TOOL, danger: true }, 'danger'],
    ['超时越界', { ...VALID_TOOL, timeoutMs: 999999 }, 'timeoutMs'],
  ])('拒绝：%s', (_label, tool, field) => {
    const result = validateAgentTool(tool)
    expect(result.valid).toBe(false)
    expect(result.errors.join('; ')).toContain(field)
  })

  it('拒绝：写操作却不要确认（等于一条无人确认的写通道）', () => {
    const result = validateAgentTool({ ...WRITE_TOOL, confirmation: 'none' })
    expect(result.valid).toBe(false)
    expect(result.errors.join('; ')).toContain('无人确认的写通道')
  })

  it('拒绝：读操作要求确认（确认疲劳会把写操作的确认也废掉）', () => {
    const result = validateAgentTool({ ...VALID_TOOL, confirmation: 'required' })
    expect(result.valid).toBe(false)
    expect(result.errors.join('; ')).toContain('确认疲劳')
  })
})

describe('Interaction Plan', () => {
  it('接受一份完整计划', () => {
    expect(validateInteractionPlan(VALID_PLAN)).toEqual({ valid: true, errors: [] })
  })

  it.each([
    ['未知 block kind（渲染器必须整份拒绝）', { ...VALID_PLAN, blocks: [{ kind: 'html', html: '<b>x</b>' }] }, '未知的 block 类型'],
    ['未知 action kind', { ...VALID_PLAN, actions: [{ kind: 'delete', id: 'd', label: '删' }] }, '未知的动作类型'],
    ['confirm 动作没有绑定工具', { ...VALID_PLAN, actions: [{ kind: 'confirm', id: 'c', label: '确认' }] }, '必须绑定一个契约内的工具'],
    ['缺 trace', { ...VALID_PLAN, trace: undefined }, 'trace'],
    ['surface 不是 kebab-case', { ...VALID_PLAN, surface: 'PurchaseOrder' }, 'surface'],
    ['空 blocks', { ...VALID_PLAN, blocks: [] }, 'blocks'],
  ])('拒绝：%s', (_label, plan, field) => {
    const result = validateInteractionPlan(plan)
    expect(result.valid).toBe(false)
    expect(result.errors.join('; ')).toContain(field)
  })

  it('拒绝：含 confirm 动作但 needsConfirmation 为 false（渲染器会按错的信号走）', () => {
    const result = validateInteractionPlan({ ...VALID_PLAN, needsConfirmation: false })
    expect(result.valid).toBe(false)
    expect(result.errors.join('; ')).toContain('needsConfirmation')
  })

  it('拒绝：trace 为空（说不出依据的计划 = 让智能体自证事实）', () => {
    const result = validateInteractionPlan({ ...VALID_PLAN, trace: { tools: [] } })
    expect(result.valid).toBe(false)
    expect(result.errors.join('; ')).toContain('trace.tools')
  })

  it('纯读计划（无 confirm 动作）合法', () => {
    const readOnly = {
      ...VALID_PLAN,
      actions: [{ kind: 'cancel', id: 'cancel', label: '好' }],
      needsConfirmation: false,
    }
    expect(validateInteractionPlan(readOnly)).toEqual({ valid: true, errors: [] })
  })
})

describe('工具契约文件（白名单整体）', () => {
  it('接受一份合法的目录', () => {
    expect(
      validateToolCatalog({ version: 1, tools: [VALID_TOOL, WRITE_TOOL] }),
    ).toEqual({ valid: true, errors: [] })
  })

  it('拒绝：重名（按名字调用会变成不确定行为）', () => {
    const result = validateToolCatalog({ version: 1, tools: [VALID_TOOL, VALID_TOOL] })
    expect(result.valid).toBe(false)
    expect(result.errors.join('; ')).toContain('工具名重复')
  })

  it('拒绝：空工具面（智能体就没有能做的事，等于白配置）', () => {
    expect(validateToolCatalog({ version: 1, tools: [] }).valid).toBe(false)
  })

  it('拒绝：契约文件版本不认识', () => {
    expect(validateToolCatalog({ version: 2, tools: [VALID_TOOL] }).valid).toBe(false)
  })
})
