// 模块 → 最小蓝图：命名/版本/依赖的拒绝路径，以及"导出物必须通过冻结协议"。
import { Validator } from 'jsonschema'
import { loadSchema } from '../common/protocol/schema-loader'
import {
  BlueprintExportError,
  PLATFORM_RUNTIME_RANGE,
  blueprintIdentity,
  buildMinimalBlueprint,
  collectEntityNames,
  parseAtomicDependencies,
  toKebabCase,
} from './blueprint-export'

describe('toKebabCase', () => {
  it.each([
    ['Auto Parts ERP', 'auto-parts-erp'],
    ['auto_parts', 'auto-parts'],
    ['CustomerCRM', 'customer-crm'],
    ['  Spaced  Out  ', 'spaced-out'],
    ['已存在模块', ''],
  ])('%s → %s', (input, expected) => {
    expect(toKebabCase(input)).toBe(expected)
  })
})

describe('blueprintIdentity', () => {
  it('合法：名字转 kebab-case，版本原样', () => {
    expect(blueprintIdentity('Auto Parts ERP', '1.0.0')).toEqual({
      blueprint: 'auto-parts-erp',
      version: '1.0.0',
    })
  })

  it('名字转不出合法标识 → 拒绝（invalid-name）', () => {
    expect(() => blueprintIdentity('已存在模块', '1.0.0')).toThrow(BlueprintExportError)
    try {
      blueprintIdentity('已存在模块', '1.0.0')
    } catch (error) {
      expect((error as BlueprintExportError).reason).toBe('invalid-name')
    }
  })

  it('版本不是语义化版本 → 拒绝（invalid-version）', () => {
    try {
      blueprintIdentity('Auto Parts', 'v1.0')
    } catch (error) {
      expect((error as BlueprintExportError).reason).toBe('invalid-version')
    }
  })
})

describe('collectEntityNames', () => {
  it('显式声明在前，capability 在后，去重', () => {
    expect(
      collectEntityNames({
        declared: ['SalesOrder', 'Customer'],
        capabilities: ['Customer', 'PurchaseOrder', null],
      }),
    ).toEqual({
      names: ['SalesOrder', 'Customer', 'PurchaseOrder'],
      dropped: [],
    })
  })

  it('不合命名约定的候选被回报，而不是静默丢弃', () => {
    const result = collectEntityNames({
      declared: ['sales_order', 'SalesOrder'],
      capabilities: ['sales_order'],
    })
    expect(result.names).toEqual(['SalesOrder'])
    expect(result.dropped).toEqual([
      { name: 'sales_order', reason: '不满足实体命名约定（需形如 SalesOrder）' },
    ])
  })
})

describe('parseAtomicDependencies', () => {
  it('合法：切成 atomic + version', () => {
    expect(parseAtomicDependencies(['available-inventory@^1.0.0'])).toEqual([
      { atomic: 'available-inventory', version: '^1.0.0' },
    ])
  })

  it.each([['available-inventory'], ['available-inventory@'], ['@^1.0.0'], ['Available@^1.0.0']])(
    '格式非法 %s → 拒绝（invalid-dependency）',
    (dependency) => {
      try {
        parseAtomicDependencies([dependency])
      } catch (error) {
        expect((error as BlueprintExportError).reason).toBe('invalid-dependency')
      }
      expect(() => parseAtomicDependencies([dependency])).toThrow(BlueprintExportError)
    },
  )
})

describe('buildMinimalBlueprint', () => {
  const input = {
    name: 'Auto Parts ERP',
    version: '1.0.0',
    entityNames: ['SalesOrder', 'Customer'],
    dependencies: [{ atomic: 'available-inventory', version: '^1.0.0' }],
  }

  it('无实体 → 拒绝（导出空骨架没有意义）', () => {
    try {
      buildMinimalBlueprint({ ...input, entityNames: [] })
    } catch (error) {
      expect((error as BlueprintExportError).reason).toBe('no-entities')
    }
  })

  it('骨架只声明"模块确实拥有"的东西：实体名 + 原子依赖 + 平台 runtime', () => {
    const { meta, semantic } = buildMinimalBlueprint(input)
    expect(meta).toEqual({
      blueprint: 'auto-parts-erp',
      version: '1.0.0',
      runtime: PLATFORM_RUNTIME_RANGE,
      dependencies: [{ atomic: 'available-inventory', version: '^1.0.0' }],
    })
    // 字段与生命周期不编：字段为空，状态机是"尚未建模"的最小可编译形状
    expect(semantic.entities).toEqual([
      { name: 'SalesOrder', fields: [], states: [{ name: 'active', initial: true, final: true }] },
      { name: 'Customer', fields: [], states: [{ name: 'active', initial: true, final: true }] },
    ])
  })

  it('没有原子依赖时不写空的 dependencies 字段', () => {
    expect(buildMinimalBlueprint({ ...input, dependencies: [] }).meta.dependencies).toBeUndefined()
  })

  it('生成的 semantic.json 必须通过冻结的协议 Schema（导出物不能自己就违规）', () => {
    const { semantic } = buildMinimalBlueprint(input)
    const result = new Validator().validate(
      semantic,
      loadSchema('blueprint-semantic.schema.json'),
    )
    expect(result.errors.map((error) => error.stack)).toEqual([])
    expect(result.valid).toBe(true)
  })
})
