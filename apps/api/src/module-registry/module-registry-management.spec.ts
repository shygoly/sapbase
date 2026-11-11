import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { ModuleRegistryService } from './module-registry.service'
import {
  ModuleRegistry,
  ModuleStatus,
  ModuleType,
} from './module-registry.entity'
import { RelationshipType } from './module-relationship.entity'
import { CapabilityType } from './module-capability.entity'
import { HealthStatus } from './module-statistics.entity'

const ORG = 'org-1'

function moduleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'module-a',
    organizationId: ORG,
    name: 'Module A',
    description: 'A',
    moduleType: ModuleType.CRUD,
    status: ModuleStatus.ACTIVE,
    version: '1.0.0',
    metadata: { entities: ['Customer'] },
    capabilities: [
      {
        id: 'cap-1',
        moduleId: 'module-a',
        capabilityType: CapabilityType.CRUD,
        entity: 'Customer',
        operations: ['create', 'read'],
        apiEndpoints: ['/api/customers'],
      },
    ],
    configurations: [],
    ...overrides,
  } as unknown as ModuleRegistry
}

function setup(options: {
  modules?: ModuleRegistry[]
  relationships?: any[]
  stats?: any[]
  configurations?: any[]
  dataSource?: any
} = {}) {
  const modules = options.modules ?? [
    moduleRow(),
    moduleRow({ id: 'module-b', name: 'Module B' }),
  ]
  const relationships = options.relationships ?? []
  const stats = options.stats ?? []
  const configurations = options.configurations ?? []
  const moduleRepository = {
    find: jest.fn(async () => modules),
    findOne: jest.fn(async ({ where }: any) =>
      modules.find(
        (module) =>
          module.id === where.id && module.organizationId === where.organizationId,
      ) ?? null,
    ),
    save: jest.fn(async (row: any) => row),
    remove: jest.fn(async () => undefined),
  }
  const relationshipRepository = {
    find: jest.fn(async ({ where }: any) =>
      relationships.filter((row) => {
        const sourceIds: string[] | null = where.sourceModuleId?._value ?? null
        if (sourceIds) {
          if (!sourceIds.includes(row.sourceModuleId)) return false
        } else if (where.sourceModuleId && row.sourceModuleId !== where.sourceModuleId) {
          return false
        }
        if (where.targetModuleId && row.targetModuleId !== where.targetModuleId) return false
        if (where.relationshipType && row.relationshipType !== where.relationshipType) {
          return false
        }
        return true
      }),
    ),
    findOne: jest.fn(async ({ where }: any) =>
      relationships.find(
        (row) =>
          row.sourceModuleId === where.sourceModuleId &&
          row.targetModuleId === where.targetModuleId &&
          row.relationshipType === where.relationshipType,
      ) ?? null,
    ),
    create: jest.fn((row: any) => ({ id: 'rel-new', ...row })),
    save: jest.fn(async (row: any) => row),
    remove: jest.fn(async () => undefined),
  }
  const capabilityRepository = {
    find: jest.fn(async ({ where }: any) =>
      (modules.find((module) => module.id === where.moduleId)?.capabilities ?? []) as any[],
    ),
  }
  const statisticsRepository = {
    find: jest.fn(async ({ where }: any) =>
      stats.filter((row) => row.moduleId === where.moduleId),
    ),
    findOne: jest.fn(async ({ where }: any) =>
      stats.find(
        (row) => row.moduleId === where.moduleId && (row.entity ?? null) === (where.entity ?? null),
      ) ?? null,
    ),
    create: jest.fn((row: any) => ({ id: `stat-${row.entity}`, ...row })),
    save: jest.fn(async (row: any) => row),
  }
  const configurationRepository = {
    find: jest.fn(async ({ where }: any) =>
      configurations.filter((row) => row.moduleId === where.moduleId),
    ),
    findOne: jest.fn(async ({ where }: any) =>
      configurations.find(
        (row) => row.id === where.id && row.moduleId === where.moduleId,
      ) ?? null,
    ),
    create: jest.fn((row: any) => ({ id: 'config-new', ...row })),
    save: jest.fn(async (row: any) => row),
    remove: jest.fn(async () => undefined),
  }
  const service = new ModuleRegistryService(
    moduleRepository as never,
    relationshipRepository as never,
    capabilityRepository as never,
    statisticsRepository as never,
    configurationRepository as never,
    {} as never,
    {} as never,
    options.dataSource as never,
  )
  return {
    service,
    moduleRepository,
    relationshipRepository,
    statisticsRepository,
    configurationRepository,
  }
}

describe('ModuleRegistryService management', () => {
  it('关系 CRUD：依赖环返回具体路径并拒绝', async () => {
    const { service } = setup({
      relationships: [
        {
          id: 'rel-1',
          sourceModuleId: 'module-b',
          targetModuleId: 'module-a',
          relationshipType: RelationshipType.DEPENDENCY,
        },
      ],
    })
    await expect(
      service.addRelationship(
        'module-a',
        {
          targetModuleId: 'module-b',
          relationshipType: RelationshipType.DEPENDENCY,
        },
        ORG,
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      service.addRelationship(
        'module-a',
        {
          targetModuleId: 'module-b',
          relationshipType: RelationshipType.DEPENDENCY,
        },
        ORG,
      ),
    ).rejects.toThrow(/循环依赖/)
  })

  it('关系 CRUD：自引用/重复关系拒绝', async () => {
    const { service } = setup()
    await expect(
      service.addRelationship(
        'module-a',
        { targetModuleId: 'module-a', relationshipType: RelationshipType.INTEGRATION },
        ORG,
      ),
    ).rejects.toThrow(/自身/)
  })

  it('关系 CRUD：重复源/目标/类型返回 409', async () => {
    const { service } = setup({
      relationships: [
        {
          id: 'rel-1',
          sourceModuleId: 'module-a',
          targetModuleId: 'module-b',
          relationshipType: RelationshipType.INTEGRATION,
        },
      ],
    })
    await expect(
      service.addRelationship(
        'module-a',
        { targetModuleId: 'module-b', relationshipType: RelationshipType.INTEGRATION },
        ORG,
      ),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('关系图：节点 + 边 + 类型计数', async () => {
    const { service } = setup({
      relationships: [
        {
          id: 'rel-1',
          sourceModuleId: 'module-a',
          targetModuleId: 'module-b',
          relationshipType: RelationshipType.DEPENDENCY,
        },
        {
          id: 'rel-2',
          sourceModuleId: 'module-b',
          targetModuleId: 'module-a',
          relationshipType: RelationshipType.DATA_FLOW,
        },
      ],
    })
    const graph = await service.getRelationshipGraph(ORG)
    expect(graph.nodes).toHaveLength(2)
    expect(graph.edges).toHaveLength(2)
    expect(graph.summary).toEqual({
      modules: 2,
      edges: 2,
      dependencies: 1,
      integrations: 0,
      dataFlows: 1,
    })
  })

  it('状态跟踪：非法状态拒绝，合法状态持久化', async () => {
    const { service, moduleRepository } = setup()
    await expect(
      service.setStatus('module-a', 'bogus' as never, ORG),
    ).rejects.toBeInstanceOf(BadRequestException)
    const saved = await service.setStatus('module-a', ModuleStatus.INACTIVE, ORG)
    expect(saved.status).toBe(ModuleStatus.INACTIVE)
    expect(moduleRepository.save).toHaveBeenCalled()
  })

  it('统计收集：真实表 COUNT(*)，找不到表记 warning', async () => {
    const dataSource = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('information_schema.tables')) {
          return [{ table_name: 'customers' }]
        }
        return [{ count: '7' }]
      }),
    }
    const { service } = setup({ dataSource })
    const rows = await service.collectStatistics('module-a', ORG)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      entity: 'Customer',
      recordCount: 7,
      errorCount: 0,
      healthStatus: HealthStatus.HEALTHY,
    })
  })

  it('健康检查：error 统计使模块整体 error', async () => {
    const { service } = setup({
      stats: [
        {
          id: 'stat-1',
          moduleId: 'module-a',
          entity: 'Customer',
          healthStatus: HealthStatus.ERROR,
          errorCount: 2,
        },
      ],
    })
    const health = await service.getHealth('module-a', ORG)
    expect(health.status).toBe(HealthStatus.ERROR)
    expect(health.checks.find((check) => check.name === 'module.statistics')?.status).toBe(
      'error',
    )
  })

  it('配置编辑：跨模块配置 404；同模块更新成功', async () => {
    const { service } = setup({
      configurations: [
        {
          id: 'config-1',
          moduleId: 'module-a',
          configType: 'usage',
          documentation: 'old',
        },
      ],
    })
    await expect(
      service.updateConfiguration('module-a', 'config-x', { documentation: 'x' }, ORG),
    ).rejects.toBeInstanceOf(NotFoundException)
    const updated = await service.updateConfiguration(
      'module-a',
      'config-1',
      { documentation: 'new' },
      ORG,
    )
    expect(updated.documentation).toBe('new')
  })

  it('文档生成：包含能力/端点/关系', async () => {
    const { service } = setup({
      relationships: [
        {
          id: 'rel-1',
          sourceModuleId: 'module-a',
          targetModuleId: 'module-b',
          relationshipType: RelationshipType.DEPENDENCY,
          description: 'depends on B',
        },
      ],
    })
    const docs = await service.generateDocumentation('module-a', ORG)
    expect(docs.markdown).toContain('# Module A')
    expect(docs.markdown).toContain('/api/customers')
    expect(docs.markdown).toContain('dependency')
    expect(docs.markdown).toContain('depends on B')
  })

  it('AI 上下文：返回模块/能力/实体/端点', async () => {
    const { service } = setup()
    const context = await service.getAiGenerationContext(ORG)
    expect(context[0]).toMatchObject({
      id: 'module-a',
      name: 'Module A',
      entities: ['Customer'],
      capabilities: [
        {
          entity: 'Customer',
          operations: ['create', 'read'],
          apiEndpoints: ['/api/customers'],
        },
      ],
    })
  })
})
