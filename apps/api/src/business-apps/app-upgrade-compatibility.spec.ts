import type { SemanticEntity } from '@sap/platform-release/blueprint/compiler'
import { checkAppUpgradeCompatibility } from './app-upgrade-compatibility'

function entity(
  name: string,
  fields: Array<Record<string, unknown>>,
  states = ['active', 'done'],
): SemanticEntity {
  return {
    name,
    fields: fields as never,
    states: states.map((state, index) => ({
      name: state,
      initial: index === 0,
      final: index === states.length - 1,
    })),
    transitions: [],
  } as SemanticEntity
}

const current = [
  entity('Customer', [
    { name: 'name', type: 'text' },
    { name: 'level', type: 'enum', values: ['A', 'B'] },
    { name: 'legacy', type: 'text' },
  ]),
  entity('Order', [{ name: 'total', type: 'decimal' }]),
]

describe('checkAppUpgradeCompatibility', () => {
  it('兼容升级通过', () => {
    const result = checkAppUpgradeCompatibility({
      current,
      target: [
        entity('Customer', [
          { name: 'name', type: 'text' },
          { name: 'level', type: 'enum', values: ['A', 'B', 'C'] },
          { name: 'legacy', type: 'text' },
          { name: 'phone', type: 'text' },
        ]),
        entity('Order', [{ name: 'total', type: 'decimal' }]),
      ],
      records: [
        { entity: 'Customer', data: { name: 'Acme', level: 'A' }, state: 'active' },
      ],
    })
    expect(result).toMatchObject({ ok: true, errors: [] })
  })

  it('实体删除仍有记录 → 阻断', () => {
    const result = checkAppUpgradeCompatibility({
      current,
      target: [entity('Customer', [{ name: 'name', type: 'text' }])],
      records: [{ entity: 'Order', data: { total: 10 }, state: 'active' }],
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('Order')
  })

  it('字段删除仍有值 → 阻断；旧记录为空只警告', () => {
    const target = [
      entity('Customer', [
        { name: 'name', type: 'text' },
        { name: 'level', type: 'enum', values: ['A', 'B'] },
      ]),
      entity('Order', [{ name: 'total', type: 'decimal' }]),
    ]
    const withValue = checkAppUpgradeCompatibility({
      current,
      target,
      records: [{ entity: 'Customer', data: { name: 'Acme', legacy: 'x' } }],
    })
    expect(withValue.ok).toBe(false)
    expect(withValue.errors.join('\n')).toContain('legacy')

    const empty = checkAppUpgradeCompatibility({
      current,
      target,
      records: [{ entity: 'Customer', data: { name: 'Acme' } }],
    })
    expect(empty.ok).toBe(true)
    expect(empty.warnings.join('\n')).toContain('legacy')
  })

  it('字段类型变化 → 阻断', () => {
    const result = checkAppUpgradeCompatibility({
      current,
      target: [
        entity('Customer', [
          { name: 'name', type: 'number' },
          { name: 'level', type: 'enum', values: ['A', 'B'] },
          { name: 'legacy', type: 'text' },
        ]),
        entity('Order', [{ name: 'total', type: 'decimal' }]),
      ],
      records: [{ entity: 'Customer', data: { name: 'Acme' } }],
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('类型从 text 变为 number')
  })

  it('删除仍被使用的枚举值 → 阻断', () => {
    const result = checkAppUpgradeCompatibility({
      current,
      target: [
        entity('Customer', [
          { name: 'name', type: 'text' },
          { name: 'level', type: 'enum', values: ['A'] },
          { name: 'legacy', type: 'text' },
        ]),
        entity('Order', [{ name: 'total', type: 'decimal' }]),
      ],
      records: [{ entity: 'Customer', data: { name: 'Acme', level: 'B' } }],
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('枚举值')
  })

  it('新必填字段无默认值且旧记录缺值 → 阻断；有默认值通过', () => {
    const target = [
      entity('Customer', [
        { name: 'name', type: 'text' },
        { name: 'level', type: 'enum', values: ['A', 'B'] },
        { name: 'legacy', type: 'text' },
        { name: 'email', type: 'text', required: true },
      ]),
      entity('Order', [{ name: 'total', type: 'decimal' }]),
    ]
    const missing = checkAppUpgradeCompatibility({
      current,
      target,
      records: [{ entity: 'Customer', data: { name: 'Acme' } }],
    })
    expect(missing.ok).toBe(false)
    expect(missing.errors.join('\n')).toContain('email')

    const withDefault = checkAppUpgradeCompatibility({
      current,
      target: [
        entity('Customer', [
          { name: 'name', type: 'text' },
          { name: 'level', type: 'enum', values: ['A', 'B'] },
          { name: 'legacy', type: 'text' },
          { name: 'email', type: 'text', required: true, default: '' },
        ]),
        entity('Order', [{ name: 'total', type: 'decimal' }]),
      ],
      records: [{ entity: 'Customer', data: { name: 'Acme' } }],
    })
    expect(withDefault.ok).toBe(true)
  })

  it('删除仍被记录使用的状态 → 阻断', () => {
    const result = checkAppUpgradeCompatibility({
      current,
      target: [
        entity('Customer', [
          { name: 'name', type: 'text' },
          { name: 'level', type: 'enum', values: ['A', 'B'] },
          { name: 'legacy', type: 'text' },
        ], ['active', 'archived']),
        entity('Order', [{ name: 'total', type: 'decimal' }]),
      ],
      records: [{ entity: 'Customer', data: { name: 'Acme' }, state: 'done' }],
    })
    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('状态')
  })
})
