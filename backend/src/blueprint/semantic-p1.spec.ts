import { Validator } from 'jsonschema'
import { loadSchema } from '../common/protocol/schema-loader'
import { detectConflicts } from './compiler'

const validator = new Validator()

const ACTIVE_STATES = [
  { name: 'active', initial: true },
  { name: 'closed', final: true },
]
const ACTIVE_TRANSITIONS = [{ from: 'active', to: 'closed' }]

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

const P1_SEMANTIC = {
  entities: [
    {
      name: 'Customer',
      fields: [{ name: 'name', type: 'text' }],
      states: ACTIVE_STATES,
      transitions: ACTIVE_TRANSITIONS,
    },
    {
      name: 'SalesOrder',
      fields: [
        { name: 'customer', type: 'reference', reference: 'Customer', onDelete: 'restrict' },
        { name: 'number', type: 'text', unique: true },
      ],
      children: ['SalesOrderLine'],
      numbering: { field: 'number', prefix: 'SO-', dateFormat: 'YYYYMMDD', width: 4 },
      states: ACTIVE_STATES,
      transitions: ACTIVE_TRANSITIONS,
    },
    {
      name: 'SalesOrderLine',
      fields: [{ name: 'order', type: 'reference', reference: 'SalesOrder' }],
      parent: { entity: 'SalesOrder', field: 'order' },
      states: ACTIVE_STATES,
      transitions: ACTIVE_TRANSITIONS,
    },
  ],
}

describe('P1 语义 Schema 形状', () => {
  it('正例：numbering + onDelete 合法，additionalProperties 仍关', () => {
    expect(schemaOf(P1_SEMANTIC).valid).toBe(true)
    expect(schemaOf({ entities: [{ ...P1_SEMANTIC.entities[0], extra: true }] }).valid).toBe(false)
    expect(
      schemaOf({
        entities: [
          {
            ...P1_SEMANTIC.entities[1],
            numbering: { ...P1_SEMANTIC.entities[1].numbering, extra: true },
          },
        ],
      }).valid,
    ).toBe(false)
  })

  it('负例：onDelete=cascade 被 Schema 拒', () => {
    const bad = {
      entities: [
        {
          name: 'Line',
          fields: [{ name: 'part', type: 'reference', reference: 'Line', onDelete: 'cascade' }],
          states: ACTIVE_STATES,
        },
      ],
    }
    expect(schemaOf(bad).valid).toBe(false)
  })
})

describe('P1 编译期判据', () => {
  it('正例：合法 numbering / onDelete 无冲突', () => {
    expect(detect(P1_SEMANTIC)).toEqual([])
  })

  it('负例：保留字字段名被拒并指明', () => {
    for (const name of ['children', 'state', 'version', 'id', 'createdAt', 'updatedAt']) {
      const conflicts = detect({
        entities: [
          {
            name: 'Part',
            fields: [{ name, type: 'text' }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      })
      expect(conflicts.join('\n')).toMatch(new RegExp(`保留字冲突：Part\\.${name}`))
    }
  })

  it('负例：numbering.field 未声明 / 非 text / 非 unique', () => {
    expect(
      detect({
        entities: [
          {
            name: 'SalesOrder',
            fields: [{ name: 'note', type: 'text' }],
            numbering: { field: 'number', prefix: 'SO-', width: 4 },
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
            fields: [{ name: 'number', type: 'number', unique: true }],
            numbering: { field: 'number', prefix: 'SO-', width: 4 },
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/必须是 type=text/)

    expect(
      detect({
        entities: [
          {
            name: 'SalesOrder',
            fields: [{ name: 'number', type: 'text' }],
            numbering: { field: 'number', prefix: 'SO-', width: 4 },
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/必须 unique: true/)
  })

  it('负例：numbering.width / prefix / dateFormat 非法', () => {
    expect(
      detect({
        entities: [
          {
            name: 'SalesOrder',
            fields: [{ name: 'number', type: 'text', unique: true }],
            numbering: { field: 'number', prefix: 'SO-', width: 0 },
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/width=0/)

    expect(
      detect({
        entities: [
          {
            name: 'SalesOrder',
            fields: [{ name: 'number', type: 'text', unique: true }],
            numbering: { field: 'number', prefix: '', width: 4 },
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/prefix 不能为空/)

    expect(
      detect({
        entities: [
          {
            name: 'SalesOrder',
            fields: [{ name: 'number', type: 'text', unique: true }],
            numbering: { field: 'number', prefix: 'SO-', dateFormat: 'YYMMDD', width: 4 },
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/dateFormat=YYMMDD/)
  })

  it('负例：onDelete 出现在非 reference 上', () => {
    expect(
      detect({
        entities: [
          {
            name: 'Part',
            fields: [{ name: 'name', type: 'text', onDelete: 'restrict' }],
            states: ACTIVE_STATES,
            transitions: ACTIVE_TRANSITIONS,
          },
        ],
      }).join('\n'),
    ).toMatch(/只允许用在 reference 上/)
  })
})
