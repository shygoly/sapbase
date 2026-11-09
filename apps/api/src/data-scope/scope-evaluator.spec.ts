import { ScopeEvaluator } from './scope-evaluator'
import type {
  DataPolicyView,
  ScopeBindingView,
  ScopeEvaluationInput,
  ScopeMembershipView,
  ScopeNodeView,
} from './data-scope.types'

const ACTOR = { userId: 'u1', roleKeys: ['province_manager'], groupKeys: [] }

const NODES: ScopeNodeView[] = [
  { id: 'p1', dimensionKey: 'region', path: '/region-east/province-js' },
  { id: 'c1', dimensionKey: 'region', path: '/region-east/province-js/city-nj' },
  { id: 'p2', dimensionKey: 'region', path: '/region-west/province-sc' },
]

const REGION_FIELD: ScopeBindingView = {
  resourceKey: 'platform:crm_customers',
  dimensionKey: 'region',
  kind: 'field',
  field: 'regionId',
}

const OWNER_FIELD: ScopeBindingView = {
  resourceKey: 'platform:crm_customers',
  dimensionKey: 'owner',
  kind: 'owner',
  field: 'ownerId',
}

function membership(overrides: Partial<ScopeMembershipView> = {}): ScopeMembershipView {
  return {
    subjectType: 'user',
    subjectId: 'u1',
    nodeId: 'p1',
    positionKey: 'province_manager',
    node: NODES[0],
    ...overrides,
  }
}

function policy(overrides: Partial<DataPolicyView> = {}): DataPolicyView {
  return {
    subject: { kind: 'role', roleKey: 'province_manager' },
    resourceKey: 'platform:crm_customers',
    actions: ['read', 'list'],
    effect: 'allow',
    scope: {
      kind: 'node',
      dimension: 'region',
      anchor: 'membership',
      positions: ['province_manager'],
      depth: 'subtree',
    },
    status: 'active',
    ...overrides,
  }
}

function input(overrides: Partial<ScopeEvaluationInput> = {}): ScopeEvaluationInput {
  return {
    resourceKey: 'platform:crm_customers',
    action: 'read',
    actor: ACTOR,
    declared: true,
    bindings: [REGION_FIELD],
    memberships: [membership()],
    nodes: NODES,
    policies: [policy()],
    ...overrides,
  }
}

describe('ScopeEvaluator', () => {
  const evaluator = new ScopeEvaluator()

  it('未声明 dataScope → all（保持租户隔离旧行为）', () => {
    expect(evaluator.evaluate(input({ declared: false }))).toEqual({ op: 'all' })
  })

  it('声明了但没有策略 → none（fail-closed）', () => {
    expect(evaluator.evaluate(input({ policies: [] }))).toEqual({ op: 'none' })
  })

  it('声明了但没有绑定 → none', () => {
    expect(evaluator.evaluate(input({ bindings: [] }))).toEqual({ op: 'none' })
  })

  it('node + subtree：省经理包含本省及下属市', () => {
    expect(evaluator.evaluate(input())).toEqual({
      op: 'in',
      field: { kind: 'column', column: 'regionId' },
      values: [
        { kind: 'literal', value: 'c1' },
        { kind: 'literal', value: 'p1' },
      ],
    })
  })

  it('node + exact：只含本节点', () => {
    expect(
      evaluator.evaluate(
        input({
          policies: [
            policy({
              scope: {
                kind: 'node',
                dimension: 'region',
                anchor: 'membership',
                positions: ['province_manager'],
                depth: 'exact',
              },
            }),
          ],
        }),
      ),
    ).toEqual({
      op: 'in',
      field: { kind: 'column', column: 'regionId' },
      values: [{ kind: 'literal', value: 'p1' }],
    })
  })

  it('node + ancestors：从市节点向上包含省/市', () => {
    expect(
      evaluator.evaluate(
        input({
          memberships: [
            membership({
              nodeId: 'c1',
              node: NODES[1],
            }),
          ],
          policies: [
            policy({
              scope: {
                kind: 'node',
                dimension: 'region',
                anchor: 'membership',
                positions: ['province_manager'],
                depth: 'ancestors',
              },
            }),
          ],
        }),
      ),
    ).toEqual({
      op: 'in',
      field: { kind: 'column', column: 'regionId' },
      values: [
        { kind: 'literal', value: 'c1' },
        { kind: 'literal', value: 'p1' },
      ],
    })
  })

  it('self：使用 owner 绑定生成 actor 谓词', () => {
    expect(
      evaluator.evaluate(
        input({
          bindings: [OWNER_FIELD],
          policies: [policy({ scope: { kind: 'self' } })],
        }),
      ),
    ).toEqual({
      op: 'eq',
      field: { kind: 'column', column: 'ownerId' },
      value: { kind: 'actor' },
    })
  })

  it('blueprint 资源：字段落在 data->>field', () => {
    expect(
      evaluator.evaluate(
        input({
          resourceKey: 'blueprint:education:Student',
          bindings: [
            {
              resourceKey: 'blueprint:education:Student',
              dimensionKey: 'class',
              kind: 'field',
              field: 'classId',
            },
          ],
          memberships: [
            membership({
              nodeId: 'class-1',
              positionKey: 'head_teacher',
              node: { id: 'class-1', dimensionKey: 'class', path: '/campus/grade/class-1' },
            }),
          ],
          nodes: [
            { id: 'class-1', dimensionKey: 'class', path: '/campus/grade/class-1' },
          ],
          policies: [
            policy({
              resourceKey: 'blueprint:education:Student',
              subject: { kind: 'role', roleKey: 'province_manager' },
              scope: {
                kind: 'node',
                dimension: 'class',
                anchor: 'membership',
                positions: ['head_teacher'],
                depth: 'exact',
              },
            }),
          ],
        }),
      ),
    ).toEqual({
      op: 'in',
      field: { kind: 'jsonb', column: 'data', path: 'classId' },
      values: [{ kind: 'literal', value: 'class-1' }],
    })
  })

  it('deny 覆盖 allow', () => {
    const expr = evaluator.evaluate(
      input({
        policies: [
          policy(),
          policy({
            effect: 'deny',
            scope: {
              kind: 'nodes',
              dimension: 'region',
              nodeIds: ['c1'],
            },
          }),
        ],
      }),
    )
    expect(expr.op).toBe('and')
    expect(expr).toMatchObject({
      op: 'and',
      args: [
        {
          op: 'in',
          field: { kind: 'column', column: 'regionId' },
        },
        {
          op: 'not',
          arg: {
            op: 'in',
            values: [{ kind: 'literal', value: 'c1' }],
          },
        },
      ],
    })
  })

  it('packageCap 与租户策略取交集', () => {
    const expr = evaluator.evaluate(
      input({
        bindings: [REGION_FIELD, OWNER_FIELD],
        policies: [policy()],
        packageCap: { kind: 'self' },
      }),
    )
    expect(expr.op).toBe('and')
    expect(expr).toMatchObject({
      op: 'and',
      args: [
        { op: 'in', field: { kind: 'column', column: 'regionId' } },
        { op: 'eq', field: { kind: 'column', column: 'ownerId' } },
      ],
    })
  })

  it('relation：生成 exists 谓词', () => {
    expect(
      evaluator.evaluate(
        input({
          resourceKey: 'blueprint:education:Course',
          bindings: [
            {
              resourceKey: 'blueprint:education:Course',
              dimensionKey: 'class',
              kind: 'relation',
              relation: {
                entity: 'TeachingAssignment',
                fromField: 'courseId',
                actorField: 'teacherId',
              },
            },
          ],
          policies: [
            policy({
              resourceKey: 'blueprint:education:Course',
              scope: { kind: 'relation' },
            }),
          ],
        }),
      ),
    ).toEqual({
      op: 'exists',
      source: { kind: 'entity', name: 'TeachingAssignment' },
      where: {
        op: 'and',
        args: [
          {
            op: 'eq',
            field: { kind: 'jsonb', column: 'data', path: 'courseId' },
            value: { kind: 'row', field: 'id' },
          },
          {
            op: 'eq',
            field: { kind: 'jsonb', column: 'data', path: 'teacherId' },
            value: { kind: 'actor' },
          },
        ],
      },
    })
  })

  it('多角色策略取并集', () => {
    const expr = evaluator.evaluate(
      input({
        actor: { userId: 'u1', roleKeys: ['province_manager', 'auditor'] },
        policies: [
          policy(),
          policy({
            subject: { kind: 'role', roleKey: 'auditor' },
            scope: { kind: 'nodes', dimension: 'region', nodeIds: ['p2'] },
          }),
        ],
      }),
    )
    expect(expr.op).toBe('or')
    expect(expr).toMatchObject({
      op: 'or',
      args: [
        { op: 'in', values: [{ kind: 'literal', value: 'c1' }, { kind: 'literal', value: 'p1' }] },
        { op: 'in', values: [{ kind: 'literal', value: 'p2' }] },
      ],
    })
  })

  it('过期成员关系不生效', () => {
    expect(
      evaluator.evaluate(
        input({
          memberships: [
            membership({ validTo: '2020-01-01T00:00:00.000Z' }),
          ],
          now: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ),
    ).toEqual({ op: 'none' })
  })

  it('缺少维度绑定 → 抛错（调用方按 fail-closed 处理）', () => {
    expect(() =>
      evaluator.evaluate(
        input({
          bindings: [OWNER_FIELD],
        }),
      ),
    ).toThrow(/缺少维度 region 的字段绑定/)
  })

  it('action 不匹配 → none', () => {
    expect(evaluator.evaluate(input({ action: 'delete' }))).toEqual({ op: 'none' })
  })
})
