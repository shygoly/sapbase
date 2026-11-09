import { ScopeEvaluator } from './scope-evaluator'
import type { DataPolicyView, ScopeNodeView } from './data-scope.types'

const evaluator = new ScopeEvaluator()

type NodeDef = [id: string, dimensionKey: string, path: string]

function nodes(defs: NodeDef[]): ScopeNodeView[] {
  return defs.map(([id, dimensionKey, path]) => ({ id, dimensionKey, path }))
}

function policy(overrides: Partial<DataPolicyView>): DataPolicyView {
  return {
    subject: { kind: 'role', roleKey: 'manager' },
    resourceKey: 'platform:crm_customers',
    actions: ['read', 'list'],
    effect: 'allow',
    scope: { kind: 'all' },
    status: 'active',
    ...overrides,
  }
}

describe('区域样板：大区 → 省 → 市', () => {
  const REGION_NODES = nodes([
    ['east', 'region', '/east'],
    ['js', 'region', '/east/js'],
    ['nj', 'region', '/east/js/nj'],
    ['west', 'region', '/west'],
    ['sc', 'region', '/west/sc'],
  ])
  const binding = {
    resourceKey: 'platform:crm_customers',
    dimensionKey: 'region',
    kind: 'field' as const,
    field: 'regionId',
  }

  function evalFor(role: string, node: ScopeNodeView, depth: 'exact' | 'subtree') {
    return evaluator.evaluate({
      resourceKey: 'platform:crm_customers',
      action: 'read',
      actor: { userId: role, roleKeys: [role], groupKeys: [] },
      declared: true,
      bindings: [binding],
      memberships: [
        {
          subjectType: 'user',
          subjectId: role,
          nodeId: node.id,
          positionKey: role,
          node,
        },
      ],
      nodes: REGION_NODES,
      policies: [
        policy({
          subject: { kind: 'role', roleKey: role },
          scope: { kind: 'node', dimension: 'region', anchor: 'membership', positions: [role], depth },
        }),
      ],
    })
  }

  it('大区经理看整个大区及下属省市', () => {
    const expr = evalFor('region_manager', REGION_NODES[0], 'subtree')
    expect(expr).toMatchObject({
      op: 'in',
      values: [
        { kind: 'literal', value: 'east' },
        { kind: 'literal', value: 'js' },
        { kind: 'literal', value: 'nj' },
      ],
    })
  })

  it('省经理只看本省及下属市', () => {
    const expr = evalFor('province_manager', REGION_NODES[1], 'subtree')
    expect(expr).toMatchObject({
      op: 'in',
      values: [
        { kind: 'literal', value: 'js' },
        { kind: 'literal', value: 'nj' },
      ],
    })
  })

  it('市经理只看本市', () => {
    const expr = evalFor('city_manager', REGION_NODES[2], 'exact')
    expect(expr).toMatchObject({
      op: 'in',
      values: [{ kind: 'literal', value: 'nj' }],
    })
  })
})

describe('学校样板：校区 → 年级 → 班级', () => {
  const SCHOOL_NODES = nodes([
    ['campus', 'campus', '/campus'],
    ['grade', 'grade', '/campus/grade-2'],
    ['class-a', 'class', '/campus/grade-2/class-a'],
    ['class-b', 'class', '/campus/grade-2/class-b'],
  ])
  const binding = {
    resourceKey: 'blueprint:education:Student',
    dimensionKey: 'class',
    kind: 'field' as const,
    field: 'classId',
  }

  function evalFor(role: string, node: ScopeNodeView, depth: 'exact' | 'subtree') {
    return evaluator.evaluate({
      resourceKey: 'blueprint:education:Student',
      action: 'read',
      actor: { userId: role, roleKeys: [role], groupKeys: [] },
      declared: true,
      bindings: [binding],
      memberships: [
        {
          subjectType: 'user',
          subjectId: role,
          nodeId: node.id,
          positionKey: role,
          node,
        },
      ],
      nodes: SCHOOL_NODES,
      policies: [
        policy({
          resourceKey: 'blueprint:education:Student',
          subject: { kind: 'role', roleKey: role },
          scope: { kind: 'node', dimension: 'class', anchor: 'membership', positions: [role], depth },
        }),
      ],
    })
  }

  it('校长看校区子树（campus 成员 + class 维度路径前缀）', () => {
    const expr = evaluator.evaluate({
      resourceKey: 'blueprint:education:Student',
      action: 'read',
      actor: { userId: 'principal', roleKeys: ['principal'], groupKeys: [] },
      declared: true,
      bindings: [binding],
      memberships: [
        {
          subjectType: 'user',
          subjectId: 'principal',
          nodeId: 'campus',
          positionKey: 'principal',
          node: SCHOOL_NODES[0],
        },
      ],
      nodes: SCHOOL_NODES,
      policies: [
        policy({
          resourceKey: 'blueprint:education:Student',
          subject: { kind: 'role', roleKey: 'principal' },
          scope: { kind: 'node', dimension: 'class', anchor: 'membership', positions: ['principal'], depth: 'subtree' },
        }),
      ],
    })
    expect(expr).toMatchObject({
      op: 'in',
      field: { kind: 'jsonb', column: 'data', path: 'classId' },
      values: [
        { kind: 'literal', value: 'class-a' },
        { kind: 'literal', value: 'class-b' },
      ],
    })
  })

  it('班主任只看本班', () => {
    const expr = evalFor('head_teacher', SCHOOL_NODES[2], 'exact')
    expect(expr).toMatchObject({
      op: 'in',
      field: { kind: 'jsonb', column: 'data', path: 'classId' },
      values: [{ kind: 'literal', value: 'class-a' }],
    })
  })
})
