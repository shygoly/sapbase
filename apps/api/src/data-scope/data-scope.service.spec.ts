import { DataScopeService } from './data-scope.service'
import { ScopeEvaluator } from './scope-evaluator'

function serviceWith(overrides: {
  bindings?: unknown[]
  policies?: unknown[]
  memberships?: unknown[]
  nodes?: unknown[]
  version?: number
} = {}) {
  const dimensions = { find: jest.fn(async () => []), findOne: jest.fn() }
  const nodes = {
    find: jest.fn(async () => overrides.nodes ?? []),
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
  }
  const memberships = {
    find: jest.fn(async () => overrides.memberships ?? []),
    save: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
  }
  const bindings = {
    find: jest.fn(async () => overrides.bindings ?? []),
    save: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
  }
  const policies = {
    find: jest.fn(async () => overrides.policies ?? []),
    save: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
  }
  const versions = {
    findOne: jest.fn(async () => ({ version: overrides.version ?? 1 })),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    manager: { query: jest.fn(async () => undefined) },
  }
  const service = new DataScopeService(
    dimensions as never,
    nodes as never,
    memberships as never,
    bindings as never,
    policies as never,
    versions as never,
    new ScopeEvaluator(),
  )
  return { service, dimensions, nodes, memberships, bindings, policies, versions }
}

describe('DataScopeService', () => {
  const base = {
    organizationId: 'org-1',
    actor: { userId: 'u1', roleKeys: ['teacher'], groupKeys: [] },
    resourceKey: 'platform:crm_customers',
    action: 'read',
  }

  it('无绑定 → 未声明 → all（租户隔离旧行为）', async () => {
    const { service } = serviceWith()
    await expect(service.resolve(base)).resolves.toMatchObject({
      expr: { op: 'all' },
      declared: false,
      version: 1,
    })
  })

  it('有绑定但无策略 → none（fail-closed）', async () => {
    const { service } = serviceWith({
      bindings: [
        {
          resourceKey: base.resourceKey,
          dimensionKey: 'region',
          kind: 'field',
          field: 'regionId',
          writable: true,
        },
      ],
    })
    await expect(service.resolve(base)).resolves.toMatchObject({
      expr: { op: 'none' },
      declared: true,
    })
  })

  it('解析结果按 scopeVersion 缓存；bump 后清空', async () => {
    const binding = {
      resourceKey: base.resourceKey,
      dimensionKey: 'region',
      kind: 'field',
      field: 'regionId',
      writable: true,
    }
    const policy = {
      id: 'p1',
      name: 'all',
      subject: { kind: 'role', roleKey: 'teacher' },
      resourceKey: base.resourceKey,
      actions: ['read'],
      effect: 'allow',
      scope: { kind: 'all' },
      priority: 0,
      status: 'active',
    }
    const { service, bindings, versions } = serviceWith({
      bindings: [binding],
      policies: [policy],
    })

    await expect(service.resolve(base)).resolves.toMatchObject({ expr: { op: 'all' }, declared: true })
    await service.resolve(base)
    expect(bindings.find).toHaveBeenCalledTimes(1)

    await service.bumpVersion('org-1')
    expect(versions.manager.query).toHaveBeenCalled()
    await service.resolve(base)
    expect(bindings.find).toHaveBeenCalledTimes(2)
  })

  it('显式绑定覆盖 DB（蓝图包场景）', async () => {
    const { service, bindings } = serviceWith()
    await service.resolve({
      ...base,
      resourceKey: 'blueprint:education:Student',
      declared: true,
      bindings: [
        {
          resourceKey: 'blueprint:education:Student',
          dimensionKey: 'class',
          kind: 'field',
          field: 'classId',
        },
      ],
      policies: [],
    })
    expect(bindings.find).not.toHaveBeenCalled()
  })
})
