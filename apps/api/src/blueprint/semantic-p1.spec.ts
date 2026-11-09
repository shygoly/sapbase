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


function permissionsSchemaOf(instance: unknown): { valid: boolean; errors: string[] } {
  const result = validator.validate(instance, loadSchema('blueprint-permissions.schema.json'))
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
      schemaOf({ entities: [{ ...P1_SEMANTIC.entities[0], autoSuggest: true }] }).valid,
    ).toBe(true)
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

describe('数据范围 dataScope（P1）', () => {
  const BASE = {
    name: 'Student',
    fields: [
      { name: 'name', type: 'text' },
      { name: 'classId', type: 'text' },
      { name: 'headTeacherId', type: 'text' },
    ],
    states: ACTIVE_STATES,
    transitions: ACTIVE_TRANSITIONS,
  }

  it('Schema 接受合法 dataScope', () => {
    const result = schemaOf({
      entities: [
        {
          ...BASE,
          dataScope: {
            ownerField: 'headTeacherId',
            bindings: [{ dimension: 'class', kind: 'field', field: 'classId' }],
          },
        },
      ],
    })
    expect(result.valid).toBe(true)
  })

  it('编译期拒绝缺失绑定字段', () => {
    expect(
      detect({
        entities: [
          {
            ...BASE,
            dataScope: {
              bindings: [{ dimension: 'class', kind: 'field', field: 'missingClassId' }],
            },
          },
        ],
      }).join('\n'),
    ).toMatch(/missingClassId.*不是本实体字段/)
  })

  it('编译期拒绝非法 dimension key', () => {
    expect(
      detect({
        entities: [
          {
            ...BASE,
            dataScope: {
              bindings: [{ dimension: 'Class', kind: 'field', field: 'classId' }],
            },
          },
        ],
      }).join('\n'),
    ).toMatch(/dimension「Class」必须是 snake_case key/)
  })

  it('编译期拒绝悬空 relation entity', () => {
    expect(
      detect({
        entities: [
          {
            ...BASE,
            dataScope: {
              bindings: [
                {
                  dimension: 'class',
                  kind: 'relation',
                  relation: {
                    entity: 'TeachingAssignment',
                    fromField: 'courseId',
                    actorField: 'teacherId',
                  },
                },
              ],
            },
          },
        ],
      }).join('\n'),
    ).toMatch(/relation\.entity「TeachingAssignment」未声明/)
  })

  it('未声明 dataScope 的旧实体不受影响', () => {
    expect(detect({ entities: [BASE] })).toEqual([])
    expect(schemaOf({ entities: [BASE] }).valid).toBe(true)
  })
})

describe('权限层 scope/dataScope（P1）', () => {
  const SEMANTIC = {
    entities: [
      {
        name: 'Student',
        fields: [
          { name: 'name', type: 'text' },
          { name: 'classId', type: 'text' },
        ],
        states: ACTIVE_STATES,
        transitions: ACTIVE_TRANSITIONS,
        dataScope: {
          ownerField: 'name',
          bindings: [{ dimension: 'class', kind: 'field', field: 'classId' }],
        },
      },
    ],
  }
  const PERMISSIONS = {
    permissions: 'blueprint-permissions/v1',
    rules: [
      {
        role: 'head_teacher',
        scope: 'policy',
        resources: ['Student'],
        actions: ['read'],
        dataScope: {
          dimension: 'class',
          depth: 'exact',
          positions: ['head_teacher'],
        },
      },
    ],
  }

  it('Schema 接受 policy + dataScope', () => {
    expect(
      permissionsSchemaOf({
        permissions: 'blueprint-permissions/v1',
        rules: PERMISSIONS.rules,
      }).valid,
    ).toBe(true)
  })

  it('Schema 拒绝 policy 缺少 dataScope', () => {
    expect(
      permissionsSchemaOf({
        permissions: 'blueprint-permissions/v1',
        rules: [{ ...PERMISSIONS.rules[0], dataScope: undefined }],
      }).valid,
    ).toBe(false)
  })

  it('编译期接受合法 policy 模板', () => {
    expect(
      detectConflicts(SEMANTIC as never, { flows: [] }, [], {
        permissions: PERMISSIONS as never,
      }),
    ).toEqual([])
  })

  it('编译期拒绝 policy 缺少 dataScope', () => {
    expect(
      detectConflicts(SEMANTIC as never, { flows: [] }, [], {
        permissions: {
          ...PERMISSIONS,
          rules: [{ ...PERMISSIONS.rules[0], dataScope: undefined }],
        } as never,
      }).join('\n'),
    ).toMatch(/scope=policy 必须声明 dataScope/)
  })

  it('编译期拒绝 own 没有 ownerField/ownership', () => {
    expect(
      detectConflicts(
        {
          entities: [
            {
              name: 'Bare',
              fields: [{ name: 'name', type: 'text' }],
              states: ACTIVE_STATES,
              transitions: ACTIVE_TRANSITIONS,
            },
          ],
        } as never,
        { flows: [] },
        [],
        {
          permissions: {
            permissions: 'blueprint-permissions/v1',
            rules: [{ role: 'x', scope: 'own', resources: ['Bare'], actions: ['read'] }],
          } as never,
        },
      ).join('\n'),
    ).toMatch(/scope=own 要求 Bare 声明 ownerField\/ownership/)
  })

  it('编译期拒绝 team 没有 dataScope.bindings', () => {
    expect(
      detectConflicts(
        {
          entities: [
            {
              name: 'Bare',
              fields: [{ name: 'name', type: 'text' }],
              states: ACTIVE_STATES,
              transitions: ACTIVE_TRANSITIONS,
            },
          ],
        } as never,
        { flows: [] },
        [],
        {
          permissions: {
            permissions: 'blueprint-permissions/v1',
            rules: [{ role: 'x', scope: 'team', resources: ['Bare'], actions: ['read'] }],
          } as never,
        },
      ).join('\n'),
    ).toMatch(/scope=team 要求 Bare 声明 dataScope\.bindings/)
  })
})
