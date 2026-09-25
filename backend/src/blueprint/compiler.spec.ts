// B3 编译器：流水线顺序、四类冲突负例、IR 双形态往返等价。
import type { BlueprintManifest } from '@speckit/shared-schemas'
import {
  CompileError,
  compileBlueprint,
  detectConflicts,
  parseIrText,
  toIrText,
} from './compiler'
import type { UnpackedBlueprint } from './packager'

const SHA = `sha256:${'a'.repeat(64)}`

/** 组装一个"已解包"的蓝图（compiler 只依赖 manifest + files）。 */
function unpacked(
  files: Record<string, unknown>,
  dependencies: BlueprintManifest['dependencies'] = [
    { atomic: 'available-inventory', version: '^1.0.0' },
  ],
): UnpackedBlueprint {
  const names = Object.keys(files)
  const manifest: BlueprintManifest = {
    blueprint: 'auto-parts-erp',
    version: '2026.1.0',
    runtime: '>=1.0.0 <2.0.0',
    dependencies,
    layers: { public: names },
    files: Object.fromEntries(names.map((name) => [name, SHA])),
  }
  return {
    manifest,
    files: new Map(
      Object.entries(files).map(([name, value]) => [
        name,
        Buffer.from(JSON.stringify(value)),
      ]),
    ),
  }
}

const VALID_SEMANTIC = {
  entities: [
    {
      name: 'SalesOrder',
      fields: [{ name: 'total', type: 'decimal' }],
      relations: [{ name: 'customer', type: 'belongsTo', target: 'Customer' }],
      states: [
        { name: 'draft', initial: true },
        { name: 'submitted' },
        { name: 'closed', final: true },
      ],
      transitions: [
        { from: 'draft', to: 'submitted' },
        { from: 'submitted', to: 'closed' },
      ],
    },
    {
      name: 'Customer',
      fields: [{ name: 'name', type: 'text' }],
      states: [{ name: 'active', initial: true }, { name: 'archived', final: true }],
      transitions: [{ from: 'active', to: 'archived' }],
    },
  ],
}

const VALID_FLOWS = {
  flows: [
    {
      id: 'SalesFlow',
      entity: 'SalesOrder',
      steps: [
        {
          id: 'checkStock',
          on: 'submitted',
          next: ['approve'],
          actions: [
            { kind: 'check', atomic: 'available-inventory@^1.0.0' },
          ],
        },
        {
          id: 'approve',
          on: 'submitted',
          actions: [
            { kind: 'require-approval', rule: 'PURCHASE_HIGH_VALUE', when: 'total > 100000' },
            { kind: 'post-accounting', entry: 'SALES_INVOICE_POSTED' },
          ],
        },
      ],
    },
  ],
}

const registry = (resolve = async () => ({ contract: { version: '1.0.0' } })) =>
  ({ resolve }) as never

describe('compileBlueprint（流水线）', () => {
  it('合法蓝图编译成功，产出结构化 IR + 文本 IR + 摘要，且 IR 通过协议校验', async () => {
    const result = await compileBlueprint(
      unpacked({ 'semantic.json': VALID_SEMANTIC, 'flows.json': VALID_FLOWS }),
      registry(),
    )

    expect(result.ir.entities.map((entity) => entity.name)).toEqual([
      'SalesOrder',
      'Customer',
    ])
    expect(result.ir.events.map((event) => event.on)).toEqual([
      'SalesOrder.submitted',
      'SalesOrder.submitted',
    ])
    expect(result.ir.dependencies).toEqual(['available-inventory@1.0.0'])
    expect(result.ir.runtime).toBe('>=1.0.0 <2.0.0')
    expect(result.irDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(result.irText).toContain('blueprint auto-parts-erp@2026.1.0')
    expect(result.irText).toContain('check using atomic:available-inventory@^1.0.0')
    expect(result.irText).toContain('require approval PURCHASE_HIGH_VALUE when total > 100000')
  })

  it('没有 flows.json 也能编译（流程可选）', async () => {
    const result = await compileBlueprint(
      unpacked({ 'semantic.json': VALID_SEMANTIC }),
      registry(),
    )
    expect(result.ir.events).toEqual([])
  })

  it('包内出现未被 v1 协议覆盖的文件 → 拒绝（不跳过）', async () => {
    await expect(
      compileBlueprint(
        unpacked({ 'semantic.json': VALID_SEMANTIC, 'forms.json': { forms: [] } }),
        registry(),
      ),
    ).rejects.toMatchObject({ reason: 'uncovered-file' })
  })

  it('文件形状非法 → schema-invalid', async () => {
    await expect(
      compileBlueprint(
        unpacked({ 'semantic.json': { entities: [{ name: 'bad-name' }] } }),
        registry(),
      ),
    ).rejects.toMatchObject({ reason: 'schema-invalid' })
  })

  it('原子依赖不可满足 → dependency-unresolved 并指明是哪个依赖', async () => {
    const failing = registry(async () => {
      throw new Error('没有 active 的契约：available-inventory')
    })
    try {
      await compileBlueprint(unpacked({ 'semantic.json': VALID_SEMANTIC }), failing)
      throw new Error('本应被拒')
    } catch (error) {
      expect((error as CompileError).reason).toBe('dependency-unresolved')
      expect((error as Error).message).toContain('available-inventory@^1.0.0')
    }
  })
})

describe('detectConflicts（四类确定性判据）', () => {
  const detect = (
    semantic: unknown,
    flows: unknown = { flows: [] },
  ) =>
    detectConflicts(
      semantic as never,
      flows as never,
      [{ atomic: 'available-inventory', version: '^1.0.0' }],
    )

  it('合法蓝图无冲突', () => {
    expect(detect(VALID_SEMANTIC, VALID_FLOWS)).toEqual([])
  })

  it('重复定义：实体 / 流程 / 步骤 / 状态', () => {
    expect(detect({ entities: [VALID_SEMANTIC.entities[0], VALID_SEMANTIC.entities[0]] })).toEqual(
      expect.arrayContaining([expect.stringContaining('重复定义：实体 SalesOrder')]),
    )
    const dupState = {
      entities: [
        {
          ...VALID_SEMANTIC.entities[0],
          states: [
            { name: 'draft', initial: true },
            { name: 'draft', final: true },
          ],
        },
      ],
    }
    expect(detect(dupState)).toEqual(
      expect.arrayContaining([expect.stringContaining('状态 draft 出现多次')]),
    )
    expect(
      detect(VALID_SEMANTIC, {
        flows: [VALID_FLOWS.flows[0], VALID_FLOWS.flows[0]],
      }),
    ).toEqual(expect.arrayContaining([expect.stringContaining('流程 SalesFlow 出现多次')]))
  })

  it('悬空引用：关系目标 / 状态 / 步骤 / 未声明的原子', () => {
    const badRelation = {
      entities: [
        {
          ...VALID_SEMANTIC.entities[0],
          relations: [{ name: 'ghost', type: 'belongsTo', target: 'Ghost' }],
        },
      ],
    }
    expect(detect(badRelation)).toEqual(
      expect.arrayContaining([expect.stringContaining('指向不存在的实体 Ghost')]),
    )

    const badTransition = {
      entities: [
        {
          ...VALID_SEMANTIC.entities[0],
          transitions: [{ from: 'draft', to: 'nowhere' }],
        },
      ],
    }
    expect(detect(badTransition)).toEqual(
      expect.arrayContaining([expect.stringContaining('未声明的状态 nowhere')]),
    )

    expect(
      detect(VALID_SEMANTIC, {
        flows: [
          {
            id: 'SalesFlow',
            entity: 'SalesOrder',
            steps: [
              {
                id: 'step1',
                on: 'submitted',
                next: ['ghostStep'],
                actions: [{ kind: 'check', atomic: 'undeclared-atomic@^1.0.0' }],
              },
            ],
          },
        ],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('指向不存在的步骤 ghostStep'),
        expect.stringContaining('未在清单中声明的原子 undeclared-atomic@^1.0.0'),
      ]),
    )
  })

  it('状态机非法：初始态不唯一 / 无终态 / 有不可达状态', () => {
    const twoInitials = {
      entities: [
        {
          ...VALID_SEMANTIC.entities[0],
          states: [
            { name: 'draft', initial: true },
            { name: 'submitted', initial: true },
            { name: 'closed', final: true },
          ],
        },
      ],
    }
    expect(detect(twoInitials)).toEqual(
      expect.arrayContaining([expect.stringContaining('初始态必须恰好 1 个')]),
    )

    const noFinal = {
      entities: [
        {
          ...VALID_SEMANTIC.entities[0],
          states: [{ name: 'draft', initial: true }, { name: 'submitted' }],
          transitions: [{ from: 'draft', to: 'submitted' }],
        },
      ],
    }
    expect(detect(noFinal)).toEqual(
      expect.arrayContaining([expect.stringContaining('没有任何终态')]),
    )

    const unreachable = {
      entities: [
        {
          ...VALID_SEMANTIC.entities[0],
          states: [
            { name: 'draft', initial: true },
            { name: 'orphan' },
            { name: 'closed', final: true },
          ],
          transitions: [{ from: 'draft', to: 'closed' }],
        },
      ],
    }
    expect(detect(unreachable)).toEqual(
      expect.arrayContaining([expect.stringContaining('状态 orphan 从初始态不可达')]),
    )
  })

  it('流程成环（v1 要求 flow 是 DAG）', () => {
    expect(
      detect(VALID_SEMANTIC, {
        flows: [
          {
            id: 'LoopFlow',
            entity: 'SalesOrder',
            steps: [
              { id: 'a', on: 'draft', next: ['b'], actions: [{ kind: 'check', atomic: 'available-inventory@^1.0.0' }] },
              { id: 'b', on: 'submitted', next: ['a'], actions: [{ kind: 'check', atomic: 'available-inventory@^1.0.0' }] },
            ],
          },
        ],
      }),
    ).toEqual(expect.arrayContaining([expect.stringContaining('流程成环：LoopFlow')]))
  })

  it('实体关系成环**不**算冲突（自引用与回指是合法建模）', () => {
    const selfReference = {
      entities: [
        ...VALID_SEMANTIC.entities,
        {
          name: 'Employee',
          fields: [{ name: 'name', type: 'text' }],
          relations: [{ name: 'manager', type: 'belongsTo', target: 'Employee' }],
          states: [{ name: 'active', initial: true }, { name: 'left', final: true }],
          transitions: [{ from: 'active', to: 'left' }],
        },
      ],
    }
    expect(detect(selfReference)).toEqual([])
  })

  it('引用了 v1 未覆盖的规则层 → 悬空（明确报出来，而不是静默放过）', () => {
    const withRule = {
      entities: [
        {
          ...VALID_SEMANTIC.entities[0],
          transitions: [{ from: 'draft', to: 'submitted', rule: 'CreditCheck' }],
        },
      ],
    }
    expect(detect(withRule)).toEqual(
      expect.arrayContaining([expect.stringContaining('引用了 v1 未覆盖的规则 CreditCheck')]),
    )
  })
})

describe('IR 双形态往返等价', () => {
  it('toIrText → parseIrText 与结构化 IR 等价（summary 为派生信息，不参与）', async () => {
    const { ir } = await compileBlueprint(
      unpacked({ 'semantic.json': VALID_SEMANTIC, 'flows.json': VALID_FLOWS }),
      registry(),
    )
    const parsed = parseIrText(toIrText(ir))
    const { summary: _ignored, ...withoutSummary } = ir
    expect(parsed).toEqual(withoutSummary)
  })

  it('文本 → 结构 → 文本 逐字节一致（可作 diff 基线）', async () => {
    const { ir, irText } = await compileBlueprint(
      unpacked({ 'semantic.json': VALID_SEMANTIC, 'flows.json': VALID_FLOWS }),
      registry(),
    )
    expect(toIrText(parseIrText(irText) as never)).toBe(irText)
    expect(toIrText(ir)).toBe(irText)
  })
})
