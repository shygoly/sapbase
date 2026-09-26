import { Validator } from 'jsonschema'
import type { BlueprintManifest } from '@speckit/shared-schemas'
import { loadSchema } from '../common/protocol/schema-loader'
import { CompileError, compileBlueprint, detectConflicts } from './compiler'
import type { UnpackedBlueprint } from './packager'

const SHA = `sha256:${'a'.repeat(64)}`
const validator = new Validator()

function unpacked(files: Record<string, unknown>): UnpackedBlueprint {
  const names = Object.keys(files)
  const manifest: BlueprintManifest = {
    blueprint: 'auto-parts-erp',
    version: '2026.1.0',
    runtime: '>=1.0.0 <2.0.0',
    dependencies: [{ atomic: 'available-inventory', version: '^1.0.0' }],
    layers: { public: names },
    files: Object.fromEntries(names.map((name) => [name, SHA])),
  }
  return {
    manifest,
    files: new Map(
      Object.entries(files).map(([name, value]) => [name, Buffer.from(JSON.stringify(value))]),
    ),
  }
}

const registry = () =>
  ({ resolve: async () => ({ contract: { version: '1.0.0' } }) }) as never

const ACTIVE_STATES = [
  { name: 'active', initial: true },
  { name: 'closed', final: true },
]
const ACTIVE_TRANSITIONS = [{ from: 'active', to: 'closed' }]

const P0_SEMANTIC = {
  entities: [
    {
      name: 'Part',
      fields: [
        { name: 'partNo', type: 'text', unique: true },
        { name: 'unit', type: 'enum', values: ['piece', 'set', 'box'] },
        {
          name: 'packSize',
          type: 'i32',
          uom: { base: 'piece', packs: [{ name: 'box', factor: 12 }] },
        },
      ],
      relations: [{ name: 'bomLines', type: 'hasMany', target: 'Part', cardinality: 'many' }],
      states: ACTIVE_STATES,
      transitions: ACTIVE_TRANSITIONS,
    },
    {
      name: 'SalesOrder',
      fields: [
        { name: 'note', type: 'text' },
        {
          name: 'totalAmount',
          type: 'decimal',
          money: true,
          currency: 'CNY',
          precision: 18,
          scale: 4,
          rounding: 'half-up',
        },
      ],
      rollups: [{ field: 'totalAmount', over: 'SalesOrderLine', of: 'amount', fn: 'sum' }],
      children: ['SalesOrderLine'],
      states: ACTIVE_STATES,
      transitions: ACTIVE_TRANSITIONS,
    },
    {
      name: 'SalesOrderLine',
      fields: [
        { name: 'order', type: 'reference', reference: 'SalesOrder' },
        { name: 'quantity', type: 'number' },
        {
          name: 'unitPrice',
          type: 'decimal',
          money: true,
          currency: 'CNY',
          precision: 18,
          scale: 4,
          rounding: 'half-up',
        },
        {
          name: 'amount',
          type: 'decimal',
          money: true,
          currency: 'CNY',
          computed: { expr: 'quantity * unitPrice', dependsOn: ['quantity', 'unitPrice'] },
        },
      ],
      parent: { entity: 'SalesOrder', field: 'order' },
      states: ACTIVE_STATES,
      transitions: ACTIVE_TRANSITIONS,
    },
  ],
}

function detect(semantic: unknown): string[] {
  return detectConflicts(semantic as never, { flows: [] }, [])
}

function schemaOf(instance: unknown): { valid: boolean; errors: string[] } {
  const result = validator.validate(instance, loadSchema('blueprint-semantic.schema.json'))
  return {
    valid: result.valid,
    errors: result.errors.map((error) => `${error.property}: ${error.message}`),
  }
}

describe('P0 语义 Schema 形状', () => {
  it('正例：P0 新声明全部合法，additionalProperties 仍关', () => {
    expect(schemaOf(P0_SEMANTIC).valid).toBe(true)
    expect(schemaOf({ entities: [{ ...P0_SEMANTIC.entities[0], extra: true }] }).valid).toBe(false)
  })

  it('负例：未知类型被拒', () => {
    const bad = {
      entities: [
        {
          name: 'Part',
          fields: [{ name: 'price', type: 'currency' }],
          states: ACTIVE_STATES,
        },
      ],
    }
    expect(schemaOf(bad).valid).toBe(false)
  })

  it('正例：标量 default 类型匹配；负例：类型不符被 Schema 拒', () => {
    expect(
      schemaOf({
        entities: [
          {
            name: 'Part',
            fields: [
              { name: 'origin', type: 'text', default: 'CN' },
              { name: 'qty', type: 'i32', default: 0 },
              { name: 'flag', type: 'boolean', default: false },
            ],
            states: ACTIVE_STATES,
          },
        ],
      }).valid,
    ).toBe(true)
    expect(
      schemaOf({
        entities: [
          {
            name: 'Part',
            fields: [{ name: 'origin', type: 'text', default: 1 }],
            states: ACTIVE_STATES,
          },
        ],
      }).valid,
    ).toBe(false)
  })

  it('负例：enum 缺 values / values 出现在非 enum 仍可由 Schema 挡一部分', () => {
    expect(
      schemaOf({
        entities: [
          {
            name: 'Part',
            fields: [{ name: 'unit', type: 'enum' }],
            states: ACTIVE_STATES,
          },
        ],
      }).valid,
    ).toBe(false)
  })
})

describe('P0 编译期判据（正负例）', () => {
  it('正例：主从 / 金额 / 枚举 / 计算字段 / uom / 基数 编译通过', async () => {
    const result = await compileBlueprint(unpacked({ 'semantic.json': P0_SEMANTIC }), registry())
    expect(result.ir.semantic?.count).toBe(3)
    expect(result.ir.semantic?.digest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(result.irText).toContain('semantic count=3 digest=')
    expect(detect(P0_SEMANTIC)).toEqual([])
  })

  it('负例：用 number 声明金额被拒并指明字段名', () => {
    const conflicts = detect({
      entities: [
        {
          name: 'Part',
          fields: [{ name: 'unitPrice', type: 'number', money: true }],
          states: ACTIVE_STATES,
          transitions: ACTIVE_TRANSITIONS,
        },
      ],
    })
    expect(conflicts.join('\n')).toMatch(/Part\.unitPrice/)
    expect(conflicts.join('\n')).toMatch(/money/)
  })

  it('负例：非法精度 / 非 decimal 上的 precision / scale>precision', () => {
    expect(
      detect({
        entities: [
          {
            name: 'Part',
            fields: [{ name: 'name', type: 'text', precision: 18 }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/Part\.name/)

    expect(
      detect({
        entities: [
          {
            name: 'Part',
            fields: [{ name: 'price', type: 'decimal', precision: 2, scale: 4 }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/scale=4 大于 precision=2/)
  })

  it('负例：循环计算字段列出环上字段序列', () => {
    const conflicts = detect({
      entities: [
        {
          name: 'Line',
          fields: [
            { name: 'a', type: 'decimal', computed: { expr: 'b + 1', dependsOn: ['b'] } },
            { name: 'b', type: 'decimal', computed: { expr: 'a + 1', dependsOn: ['a'] } },
          ],
          states: ACTIVE_STATES,
          transitions: ACTIVE_TRANSITIONS,
        },
      ],
    })
    expect(conflicts.join('\n')).toMatch(/a → b → a|b → a → b/)
  })

  it('负例：计算字段引用不存在 / dependsOn 漏标识符 / expr 语法错', () => {
    expect(
      detect({
        entities: [
          {
            name: 'Line',
            fields: [
              { name: 'quantity', type: 'number' },
              {
                name: 'amount',
                type: 'decimal',
                computed: { expr: 'quantity * ghost', dependsOn: ['quantity', 'ghost'] },
              },
            ],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/未声明的字段 ghost/)

    expect(
      detect({
        entities: [
          {
            name: 'Line',
            fields: [
              { name: 'quantity', type: 'number' },
              { name: 'unitPrice', type: 'decimal' },
              {
                name: 'amount',
                type: 'decimal',
                computed: { expr: 'quantity * unitPrice', dependsOn: ['quantity'] },
              },
            ],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/未覆盖 expr 标识符 unitPrice/)

    expect(
      detect({
        entities: [
          {
            name: 'Line',
            fields: [
              {
                name: 'amount',
                type: 'decimal',
                computed: { expr: 'quantity *', dependsOn: [] },
              },
            ],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/计算字段非法/)
  })

  it('负例：头行 children/parent 不一致指明哪一侧', () => {
    const missingParent = detect({
      entities: [
        {
          name: 'SalesOrder',
          fields: [{ name: 'note', type: 'text' }],
          children: ['SalesOrderLine'],
          states: ACTIVE_STATES,
          transitions: ACTIVE_TRANSITIONS,
        },
        {
          name: 'SalesOrderLine',
          fields: [{ name: 'qty', type: 'number' }],
          states: ACTIVE_STATES,
          transitions: ACTIVE_TRANSITIONS,
        },
      ],
    })
    expect(missingParent.join('\n')).toMatch(/未声明 parent/)

    const badField = detect({
      entities: [
        {
          name: 'SalesOrder',
          fields: [{ name: 'note', type: 'text' }],
          children: ['SalesOrderLine'],
          states: ACTIVE_STATES,
          transitions: ACTIVE_TRANSITIONS,
        },
        {
          name: 'SalesOrderLine',
          fields: [{ name: 'qty', type: 'number' }],
          parent: { entity: 'SalesOrder', field: 'qty' },
          states: ACTIVE_STATES,
          transitions: ACTIVE_TRANSITIONS,
        },
      ],
    })
    expect(badField.join('\n')).toMatch(/type=reference/)
  })

  it('负例：unique 出现在 reference / computed；manyToMany；uom 出现在 text', () => {
    expect(
      detect({
        entities: [
          {
            name: 'Part',
            fields: [{ name: 'supplier', type: 'reference', reference: 'Part', unique: true }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/reference/)

    expect(
      detect({
        entities: [
          {
            name: 'Line',
            fields: [
              { name: 'quantity', type: 'number' },
              {
                name: 'amount',
                type: 'decimal',
                unique: true,
                computed: { expr: 'quantity + 1', dependsOn: ['quantity'] },
              },
            ],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/计算字段/)

    expect(
      detect({
        entities: [
          {
            name: 'Part',
            fields: [{ name: 'name', type: 'text' }],
            relations: [{ name: 'suppliers', type: 'manyToMany', target: 'Part' }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/显式中间实体/)

    expect(
      detect({
        entities: [
          {
            name: 'Part',
            fields: [
              {
                name: 'name',
                type: 'text',
                uom: { base: 'piece', packs: [{ name: 'box', factor: 12 }] },
              },
            ],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/number\/decimal\/i32/)
  })

  it('负例：uom factor 为 0 / 负数 / 非整数 / 分母 0', () => {
    const cases: unknown[] = [0, -1, 1.5, { numerator: 1, denominator: 0 }]
    for (const factor of cases) {
      const conflicts = detect({
        entities: [
          {
            name: 'Part',
            fields: [
              {
                name: 'packSize',
                type: 'i32',
                uom: { base: 'piece', packs: [{ name: 'box', factor }] },
              },
            ],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      })
      expect(conflicts.join('\n')).toMatch(/单位非法/)
    }
  })

  it('负例：default 出现在 reference / computed，或类型不符 / enum 不在 values', () => {
    expect(
      detect({
        entities: [
          {
            name: 'Part',
            fields: [{ name: 'supplier', type: 'reference', reference: 'Supplier', default: 'x' }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
          {
            name: 'Supplier',
            fields: [{ name: 'name', type: 'text' }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/Part\.supplier 是 reference，不能声明 default/)

    expect(
      detect({
        entities: [
          {
            name: 'Line',
            fields: [
              {
                name: 'amount',
                type: 'decimal',
                computed: { expr: '1', dependsOn: [] },
                default: '0',
              },
            ],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/Line\.amount 是计算字段，不能声明 default/)

    expect(
      detect({
        entities: [
          {
            name: 'Part',
            fields: [{ name: 'qty', type: 'i32', default: 'zero' }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/Part\.qty .*i32/)

    expect(
      detect({
        entities: [
          {
            name: 'Part',
            fields: [{ name: 'unit', type: 'enum', values: ['piece', 'set'], default: 'box' }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/Part\.unit 的 default「box」不在 values 里/)
  })

  it('负例：未知类型走 Schema 闸（compileBlueprint）', async () => {
    await expect(
      compileBlueprint(
        unpacked({
          'semantic.json': {
            entities: [
              {
                name: 'Part',
                fields: [{ name: 'price', type: 'currency' }],
                states: ACTIVE_STATES,
              },
            ],
          },
        }),
        registry(),
      ),
    ).rejects.toBeInstanceOf(CompileError)
    await expect(
      compileBlueprint(
        unpacked({
          'semantic.json': {
            entities: [
              {
                name: 'Part',
                fields: [{ name: 'price', type: 'currency' }],
                states: ACTIVE_STATES,
              },
            ],
          },
        }),
        registry(),
      ),
    ).rejects.toMatchObject({ reason: 'schema-invalid' })
  })
})

describe('P0 IR 摘要覆盖语义层内容', () => {
  async function digestOf(semantic: unknown): Promise<string> {
    const result = await compileBlueprint(unpacked({ 'semantic.json': semantic }), registry())
    return result.irDigest
  }

  it('改 type / unique / precision / computed.expr 各一次 → irDigest 必变', async () => {
    const base = structuredClone(P0_SEMANTIC)
    const baseDigest = await digestOf(base)

    const typeChanged = structuredClone(P0_SEMANTIC)
    typeChanged.entities[0].fields[2] = { ...typeChanged.entities[0].fields[2], type: 'number' }
    expect(await digestOf(typeChanged)).not.toBe(baseDigest)

    const uniqueChanged = structuredClone(P0_SEMANTIC)
    uniqueChanged.entities[0].fields[0] = { name: 'partNo', type: 'text' }
    expect(await digestOf(uniqueChanged)).not.toBe(baseDigest)

    const precisionChanged = structuredClone(P0_SEMANTIC)
    const precisionField = {
      ...precisionChanged.entities[2].fields[2],
      precision: 16,
    }
    precisionChanged.entities[2].fields[2] = precisionField as never
    expect(await digestOf(precisionChanged)).not.toBe(baseDigest)

    const exprChanged = structuredClone(P0_SEMANTIC)
    const exprField = {
      ...exprChanged.entities[2].fields[3],
      computed: { expr: 'quantity + unitPrice', dependsOn: ['quantity', 'unitPrice'] },
    }
    exprChanged.entities[2].fields[3] = exprField as never
    expect(await digestOf(exprChanged)).not.toBe(baseDigest)
  })

  it('改 rollups → irDigest 必变', async () => {
    const base = structuredClone(P0_SEMANTIC)
    const baseDigest = await digestOf(base)
    const rollupChanged = structuredClone(P0_SEMANTIC)
    rollupChanged.entities[1].rollups = [
      { field: 'totalAmount', over: 'SalesOrderLine', of: 'amount', fn: 'max' },
    ]
    expect(await digestOf(rollupChanged)).not.toBe(baseDigest)
  })
})

describe('P2 rollups 编译期判据', () => {
  it('负例：field 未声明 / over 不是 children / of 不是行字段 / of 指向 rollup / decimal 合计非 decimal', () => {
    expect(
      detect({
        entities: [
          {
            name: 'SalesOrder',
            fields: [{ name: 'note', type: 'text' }],
            children: ['SalesOrderLine'],
            rollups: [{ field: 'ghost', over: 'SalesOrderLine', of: 'quantity', fn: 'sum' }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
          {
            name: 'SalesOrderLine',
            fields: [
              { name: 'order', type: 'reference', reference: 'SalesOrder' },
              { name: 'quantity', type: 'number' },
            ],
            parent: { entity: 'SalesOrder', field: 'order' },
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/不是本实体已声明字段/)

    expect(
      detect({
        entities: [
          {
            name: 'SalesOrder',
            fields: [{ name: 'totalAmount', type: 'decimal' }],
            children: ['SalesOrderLine'],
            rollups: [{ field: 'totalAmount', over: 'Customer', of: 'quantity', fn: 'sum' }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
          {
            name: 'SalesOrderLine',
            fields: [
              { name: 'order', type: 'reference', reference: 'SalesOrder' },
              { name: 'quantity', type: 'number' },
            ],
            parent: { entity: 'SalesOrder', field: 'order' },
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
          {
            name: 'Customer',
            fields: [{ name: 'name', type: 'text' }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/不是 .*children/)

    expect(
      detect({
        entities: [
          {
            name: 'SalesOrder',
            fields: [{ name: 'totalAmount', type: 'decimal' }],
            children: ['SalesOrderLine'],
            rollups: [{ field: 'totalAmount', over: 'SalesOrderLine', of: 'ghost', fn: 'sum' }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
          {
            name: 'SalesOrderLine',
            fields: [
              { name: 'order', type: 'reference', reference: 'SalesOrder' },
              { name: 'quantity', type: 'number' },
            ],
            parent: { entity: 'SalesOrder', field: 'order' },
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/不是行实体/)

    expect(
      detect({
        entities: [
          {
            name: 'SalesOrder',
            fields: [{ name: 'totalAmount', type: 'decimal' }],
            children: ['SalesOrderLine'],
            rollups: [{ field: 'totalAmount', over: 'SalesOrderLine', of: 'lineTotal', fn: 'sum' }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
          {
            name: 'SalesOrderLine',
            fields: [
              { name: 'order', type: 'reference', reference: 'SalesOrder' },
              { name: 'quantity', type: 'number' },
              { name: 'lineTotal', type: 'decimal' },
            ],
            rollups: [{ field: 'lineTotal', over: 'Ghost', of: 'x', fn: 'sum' }],
            parent: { entity: 'SalesOrder', field: 'order' },
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/另一层 rollup/)

    expect(
      detect({
        entities: [
          {
            name: 'SalesOrder',
            fields: [{ name: 'totalAmount', type: 'decimal' }],
            children: ['SalesOrderLine'],
            rollups: [{ field: 'totalAmount', over: 'SalesOrderLine', of: 'quantity', fn: 'sum' }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
          {
            name: 'SalesOrderLine',
            fields: [
              { name: 'order', type: 'reference', reference: 'SalesOrder' },
              { name: 'quantity', type: 'number' },
            ],
            parent: { entity: 'SalesOrder', field: 'order' },
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/金额只能合计金额/)
  })
})

describe('P5 货币与权限编译期判据', () => {
  it('负例：money 未声明 currency / 非 money 声明 currency', () => {
    expect(
      detect({
        entities: [
          {
            name: 'Part',
            fields: [{ name: 'unitCost', type: 'decimal', money: true }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/Part\.unitCost/)

    expect(
      detect({
        entities: [
          {
            name: 'Part',
            fields: [{ name: 'partNo', type: 'text', currency: 'CNY' }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/Part\.partNo/)
  })

  it('负例：computed.expr 引用的 money 字段货币不一致', () => {
    const conflicts = detect({
      entities: [
        {
          name: 'Line',
          fields: [
            { name: 'cny', type: 'decimal', money: true, currency: 'CNY' },
            { name: 'usd', type: 'decimal', money: true, currency: 'USD' },
            {
              name: 'total',
              type: 'decimal',
              money: true,
              currency: 'CNY',
              computed: { expr: 'cny + usd', dependsOn: ['cny', 'usd'] },
            },
          ],
          states: ACTIVE_STATES,
          transitions: ACTIVE_TRANSITIONS,
        },
      ],
    })
    expect(conflicts.join('\n')).toMatch(/Line\.cny/)
    expect(conflicts.join('\n')).toMatch(/Line\.usd/)
    expect(conflicts.join('\n')).toMatch(/CNY/)
    expect(conflicts.join('\n')).toMatch(/USD/)
  })

  it('负例：rollup of 与目标 field 货币不一致', () => {
    const conflicts = detect({
      entities: [
        {
          name: 'SalesOrder',
          fields: [{ name: 'totalAmount', type: 'decimal', money: true, currency: 'CNY' }],
          children: ['SalesOrderLine'],
          rollups: [{ field: 'totalAmount', over: 'SalesOrderLine', of: 'amount', fn: 'sum' }],
          states: ACTIVE_STATES,
          transitions: ACTIVE_TRANSITIONS,
        },
        {
          name: 'SalesOrderLine',
          fields: [
            { name: 'order', type: 'reference', reference: 'SalesOrder' },
            { name: 'amount', type: 'decimal', money: true, currency: 'USD' },
          ],
          parent: { entity: 'SalesOrder', field: 'order' },
          states: ACTIVE_STATES,
          transitions: ACTIVE_TRANSITIONS,
        },
      ],
    })
    expect(conflicts.join('\n')).toMatch(/SalesOrderLine\.amount/)
    expect(conflicts.join('\n')).toMatch(/SalesOrder\.totalAmount/)
    expect(conflicts.join('\n')).toMatch(/USD/)
    expect(conflicts.join('\n')).toMatch(/CNY/)
  })

  it('负例：记账规则内金额引用货币不一致', () => {
    const conflicts = detectConflicts(
      {
        entities: [
          {
            name: 'SalesOrder',
            fields: [
              { name: 'total', type: 'decimal', money: true, currency: 'CNY' },
              { name: 'tax', type: 'decimal', money: true, currency: 'USD' },
            ],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      } as never,
      { flows: [] },
      [],
      {
        rules: {
          rules: 'blueprint-rules/v1',
          validation: [],
          approval: [],
          accounting: [
            {
              id: 'mixed-ccy',
              on: 'SalesOrder.closed',
              entries: [
                { account: '1122', side: 'debit', amount: '$entity.total' },
                { account: '2221', side: 'credit', amount: '$entity.tax' },
              ],
            },
          ],
        },
      },
    )
    expect(conflicts.join('\n')).toMatch(/mixed-ccy/)
    expect(conflicts.join('\n')).toMatch(/SalesOrder\.total/)
    expect(conflicts.join('\n')).toMatch(/SalesOrder\.tax/)
    expect(conflicts.join('\n')).toMatch(/CNY/)
    expect(conflicts.join('\n')).toMatch(/USD/)
  })

  it('负例：ownership 指向不存在的字段 / 非 text；权限形状非法', () => {
    expect(
      detect({
        entities: [
          {
            name: 'SalesOrder',
            fields: [{ name: 'note', type: 'text' }],
            ownership: { field: 'ghost', readAllPermission: 'sales.order.readall' },
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/ghost/)

    expect(
      detect({
        entities: [
          {
            name: 'SalesOrder',
            fields: [{ name: 'qty', type: 'number' }],
            ownership: { field: 'qty', readAllPermission: 'sales.order.readall' },
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/type=text/)

    expect(
      detect({
        entities: [
          {
            name: 'Part',
            fields: [{ name: 'unitCost', type: 'decimal', permissions: { read: 'cost' } }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/permissions\.read/)
  })
})
