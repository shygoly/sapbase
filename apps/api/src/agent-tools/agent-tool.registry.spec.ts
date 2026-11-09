import { BadRequestException, ForbiddenException, HttpException, NotFoundException } from '@nestjs/common'
import { AgentToolRegistry } from './agent-tool.registry'
import { type ToolCatalog, loadToolCatalog } from './contracts-loader'
import { digestToolArgs } from './confirmation-token.service'

function readCatalog(): ToolCatalog {
  return loadToolCatalog()
}

function createRegistry(overrides?: {
  list?: jest.Mock
  manifestOf?: jest.Mock
  compile?: jest.Mock
  findAll?: jest.Mock
  exportBlueprint?: jest.Mock
  invokeAtomic?: jest.Mock
  resolveAtomic?: jest.Mock
  refresh?: jest.Mock
  auditCreate?: jest.Mock
  consume?: jest.Mock
  issue?: jest.Mock
  dataScopeAssert?: jest.Mock
}) {
  const blueprints = {
    list: overrides?.list ?? jest.fn(async () => [{ id: 'bp-1' }]),
    manifestOf: overrides?.manifestOf ?? jest.fn(() => ({ blueprint: 'demo' })),
    compile: overrides?.compile ?? jest.fn(async () => ({ irDigest: 'abc' })),
  }
  const modules = {
    findAll: overrides?.findAll ?? jest.fn(async () => [{ id: 'mod-1' }]),
    exportBlueprint: overrides?.exportBlueprint ?? jest.fn(async () => ({ packagePath: '/tmp/x.erpkg' })),
  }
  const executor = {
    invoke: overrides?.invokeAtomic ?? jest.fn(async () => ({ rows: 0 })),
  }
  const revocations = {
    refresh: overrides?.refresh ?? jest.fn(() => ({ list: { version: 1, revoked: [] } })),
  }
  const atomics = {
    resolve: overrides?.resolveAtomic ?? jest.fn(async () => ({ contract: { kind: 'calculation' } })),
  }
  const auditLogs = {
    create: overrides?.auditCreate ?? jest.fn(async (row: unknown) => row),
  }
  const tokens = {
    issue: overrides?.issue ?? jest.fn(),
    consume: overrides?.consume ?? jest.fn(async () => undefined),
  }
  const dataScopeGuard = overrides?.dataScopeAssert
    ? { assertAllowed: overrides.dataScopeAssert }
    : undefined

  const registry = new AgentToolRegistry(
    blueprints as never,
    modules as never,
    executor as never,
    revocations as never,
    atomics as never,
    auditLogs as never,
    tokens as never,
    { list: jest.fn(async () => []) } as never,
    { createProposal: jest.fn(), issuePreviewToken: jest.fn(), validateProposal: jest.fn() } as never,
    dataScopeGuard as never,
  )
  return {
    registry,
    blueprints,
    modules,
    executor,
    auditLogs,
    tokens,
    atomics,
    dataScopeGuard,
  }
}

const ACTOR = {
  organizationId: 'org-1',
  actor: 'user@example.com',
  grantedPermissions: [
    'tool:blueprint:read',
    'tool:blueprint:compile',
    'tool:atomic:invoke',
    'tool:module:read',
    'tool:module:export',
  ],
}

describe('AgentToolRegistry 调用链', () => {
  it('未知工具 → 明确「没有这个能力」，且不执行、不写审计', async () => {
    const { registry, blueprints, auditLogs } = createRegistry()
    await expect(
      registry.invoke({ ...ACTOR, name: 'erp_delete_order', args: {} }),
    ).rejects.toThrow(/没有这个能力/)
    await expect(
      registry.invoke({ ...ACTOR, name: 'erp_delete_order', args: {} }),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(blueprints.list).not.toHaveBeenCalled()
    expect(auditLogs.create).not.toHaveBeenCalled()
  })

  it('越权（缺 tool:*）→ 拒，错误信息写明缺哪条权限点，且不执行', async () => {
    const { registry, blueprints, auditLogs } = createRegistry()
    await expect(
      registry.invoke({
        ...ACTOR,
        grantedPermissions: ['tool:module:read'],
        name: 'erp_blueprint_list',
        args: {},
      }),
    ).rejects.toThrow(/tool:blueprint:read/)
    await expect(
      registry.invoke({
        ...ACTOR,
        grantedPermissions: [],
        name: 'erp_blueprint_list',
        args: {},
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(blueprints.list).not.toHaveBeenCalled()
    expect(auditLogs.create).not.toHaveBeenCalled()
  })

  it('参数形状非法（多传一个字段）→ 拒，指向参数路径', async () => {
    const { registry, blueprints } = createRegistry()
    await expect(
      registry.invoke({
        ...ACTOR,
        name: 'erp_blueprint_manifest',
        args: { id: 'pack-1', extra: true },
      }),
    ).rejects.toThrow(/extra/)
    await expect(
      registry.invoke({
        ...ACTOR,
        name: 'erp_blueprint_manifest',
        args: { id: 'pack-1', extra: true },
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(blueprints.manifestOf).not.toHaveBeenCalled()
  })

  it('写工具无令牌 → 拒', async () => {
    const { registry, modules, tokens } = createRegistry()
    await expect(
      registry.invoke({
        ...ACTOR,
        name: 'erp_module_export',
        args: { id: 'mod-1' },
      }),
    ).rejects.toThrow(/确认令牌/)
    expect(tokens.consume).not.toHaveBeenCalled()
    expect(modules.exportBlueprint).not.toHaveBeenCalled()
  })

  it('写工具令牌 args 不匹配（改一个参数值）→ 拒', async () => {
    const consume = jest.fn(async (input: { argsDigest: string }) => {
      if (input.argsDigest !== digestToolArgs({ id: 'mod-1' })) {
        throw new ForbiddenException('确认令牌无效或已失效（过期、已用、参数不匹配或工具不匹配一律拒绝）')
      }
    })
    const { registry, modules } = createRegistry({ consume })
    await expect(
      registry.invoke({
        ...ACTOR,
        name: 'erp_module_export',
        args: { id: 'mod-2' },
        confirmationToken: 'tok-1',
      }),
    ).rejects.toThrow(/参数不匹配|已失效/)
    expect(consume).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'tok-1',
        tool: 'erp_module_export',
        argsDigest: digestToolArgs({ id: 'mod-2' }),
        organizationId: 'org-1',
      }),
    )
    expect(modules.exportBlueprint).not.toHaveBeenCalled()
  })

  it('写工具令牌已消费 / 已过期 → 拒', async () => {
    const consume = jest.fn(async () => {
      throw new ForbiddenException('确认令牌无效或已失效（过期、已用、参数不匹配或工具不匹配一律拒绝）')
    })
    const { registry, modules } = createRegistry({ consume })
    await expect(
      registry.invoke({
        ...ACTOR,
        name: 'erp_module_export',
        args: { id: 'mod-1' },
        confirmationToken: 'tok-used',
      }),
    ).rejects.toThrow(/已用|已失效/)
    expect(modules.exportBlueprint).not.toHaveBeenCalled()
  })

  it('应用上下文绑定确认令牌并进入审计', async () => {
    const consume = jest.fn(async () => undefined)
    const auditCreate = jest.fn(async (row: unknown) => row)
    const { registry, modules } = createRegistry({ consume, auditCreate })
    const appContext = {
      organizationId: 'org-1',
      appInstallationId: 'app-erp',
      appKey: 'erp',
      userId: 'user-1',
      grantedPermissions: ['tool:module:export'],
      runtimeProfile: 'shared-saas' as const,
      traceId: 'trace-1',
    }

    await registry.invoke({
      ...ACTOR,
      name: 'erp_module_export',
      args: { id: 'mod-1' },
      confirmationToken: 'tok-1',
      appContext,
    })

    expect(consume).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'tok-1',
        appInstallationId: 'app-erp',
      }),
    )
    expect(modules.exportBlueprint).toHaveBeenCalled()
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          appInstallationId: 'app-erp',
          appKey: 'erp',
          traceId: 'trace-1',
        }),
      }),
    )
  })

  it('成功调用 → 恰好一条 chat.tool.invoked 审计，status=success，sensitiveArgs 被脱敏', async () => {
    const { registry, blueprints, auditLogs } = createRegistry()
    const catalog: ToolCatalog = {
      version: 1,
      tools: readCatalog().tools.map((tool) =>
        tool.name === 'erp_blueprint_list'
          ? {
              ...tool,
              sensitiveArgs: ['secret'],
              parameters: {
                type: 'object',
                properties: { secret: { type: 'string' } },
                additionalProperties: false,
              },
            }
          : tool,
      ),
    }

    const result = await registry.invoke(
      {
        ...ACTOR,
        name: 'erp_blueprint_list',
        args: { secret: 'hunter2' },
      },
      catalog,
    )
    expect(result).toEqual({ ok: true, tool: 'erp_blueprint_list', result: [{ id: 'bp-1' }] })
    expect(blueprints.list).toHaveBeenCalledTimes(1)
    expect(auditLogs.create).toHaveBeenCalledTimes(1)
    const row = auditLogs.create.mock.calls[0][0]
    expect(row.action).toBe('chat.tool.invoked')
    expect(row.resource).toBe('agent-tool')
    expect(row.status).toBe('success')
    expect(row.organizationId).toBe('org-1')
    expect(row.metadata.tool).toBe('erp_blueprint_list')
    expect(row.metadata.argsDigest).toBe(digestToolArgs({ secret: 'hunter2' }))
    expect(typeof row.metadata.elapsedMs).toBe('number')
    expect(row.metadata.sensitiveArgs).toEqual({ secret: '***' })
    expect(row.metadata.args.secret).toBe('***')
    expect(JSON.stringify(row.metadata)).not.toContain('hunter2')
    expect(row.metadata.organizationId).toBeUndefined()
  })

  it('执行抛错 → 审计仍写入且 status=failure 带 reason，错误原样抛出', async () => {
    const list = jest.fn(async () => {
      throw new Error('disk full')
    })
    const { registry, auditLogs } = createRegistry({ list })
    await expect(
      registry.invoke({ ...ACTOR, name: 'erp_blueprint_list', args: {} }),
    ).rejects.toThrow('disk full')
    expect(auditLogs.create).toHaveBeenCalledTimes(1)
    const row = auditLogs.create.mock.calls[0][0]
    expect(row.action).toBe('chat.tool.invoked')
    expect(row.status).toBe('failure')
    expect(row.metadata.reason).toBe('disk full')
  })

  it('缺 organizationId → 拒且不执行', async () => {
    const { registry, blueprints, auditLogs } = createRegistry()
    await expect(
      registry.invoke({
        ...ACTOR,
        organizationId: undefined,
        name: 'erp_blueprint_list',
        args: {},
      }),
    ).rejects.toBeInstanceOf(HttpException)
    await expect(
      registry.invoke({
        ...ACTOR,
        organizationId: undefined,
        name: 'erp_blueprint_list',
        args: {},
      }),
    ).rejects.toThrow(/organizationId/)
    expect(blueprints.list).not.toHaveBeenCalled()
    expect(auditLogs.create).not.toHaveBeenCalled()
  })

  it('erp_blueprint_compile 声明为读（write=false）时，stamp 这条写通道必须不存在', async () => {
    const compile = readCatalog().tools.find((tool) => tool.name === 'erp_blueprint_compile')
    expect(compile?.write).toBe(false)
    expect(compile?.confirmation).toBe('none')
    // write=false 就必须**真的不写**：stamp=true 会把 IR 摘要写回包内清单，
    // 那是一条绕过"写操作必须确认"的通道。所以它连参数都不该存在
    // （未声明即不存在），而不是"传了也不生效"。
    expect(Object.keys((compile?.parameters.properties as object) ?? {})).toEqual(['id'])

    const { registry, blueprints } = createRegistry()
    await expect(
      registry.invoke({
        ...ACTOR,
        name: 'erp_blueprint_compile',
        args: { id: 'pack-1', stamp: true },
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(blueprints.compile).not.toHaveBeenCalled()

    await registry.invoke({
      ...ACTOR,
      name: 'erp_blueprint_compile',
      args: { id: 'pack-1' },
    })
    expect(blueprints.compile).toHaveBeenCalledWith('pack-1', { stamp: false })
  })
})


describe('AgentToolRegistry 数据范围执行点', () => {
  function catalogWithDataScope(): ToolCatalog {
    const base = readCatalog().tools.find((tool) => tool.name === 'erp_blueprint_list')
    if (!base) throw new Error('测试契约缺少 erp_blueprint_list')
    return {
      version: 1,
      tools: [
        {
          ...base,
          dataScope: { resourceKey: 'platform:blueprints', action: 'list' },
        },
      ],
    }
  }

  it('声明 dataScope → 调用前经过 guard，且带可信 actor/权限', async () => {
    const assertAllowed = jest.fn(async () => undefined)
    const { registry, blueprints } = createRegistry({ dataScopeAssert: assertAllowed })
    const catalog = catalogWithDataScope()

    await registry.invoke(
      { ...ACTOR, name: 'erp_blueprint_list', args: {} },
      catalog,
    )

    expect(assertAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        resourceKey: 'platform:blueprints',
        action: 'list',
        declared: true,
        actor: expect.objectContaining({
          userId: 'user@example.com',
          permissions: ACTOR.grantedPermissions,
        }),
      }),
    )
    expect(blueprints.list).toHaveBeenCalledTimes(1)
  })

  it('guard 判定 none（抛 403）→ 不执行、不写审计', async () => {
    const assertAllowed = jest.fn(async () => {
      throw new ForbiddenException('数据范围拒绝')
    })
    const { registry, blueprints, auditLogs } = createRegistry({
      dataScopeAssert: assertAllowed,
    })

    await expect(
      registry.invoke({ ...ACTOR, name: 'erp_blueprint_list', args: {} }, catalogWithDataScope()),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(blueprints.list).not.toHaveBeenCalled()
    expect(auditLogs.create).not.toHaveBeenCalled()
  })

  it('声明了 dataScope 但运行时未装配 guard → fail-closed', async () => {
    const { registry, blueprints } = createRegistry()
    await expect(
      registry.invoke({ ...ACTOR, name: 'erp_blueprint_list', args: {} }, catalogWithDataScope()),
    ).rejects.toThrow(/未装配 DataScopeGuard/)
    expect(blueprints.list).not.toHaveBeenCalled()
  })

  it('未声明 dataScope → 不调用 guard（旧行为）', async () => {
    const assertAllowed = jest.fn(async () => undefined)
    const { registry } = createRegistry({ dataScopeAssert: assertAllowed })
    await registry.invoke({ ...ACTOR, name: 'erp_blueprint_list', args: {} })
    expect(assertAllowed).not.toHaveBeenCalled()
  })

  it('数据范围判定先于确认令牌消费：越权不能烧令牌', async () => {
    const assertAllowed = jest.fn(async () => {
      throw new ForbiddenException('数据范围拒绝')
    })
    const consume = jest.fn(async () => undefined)
    const issue = jest.fn(async () => ({ token: 't' }))
    const { registry } = createRegistry({ dataScopeAssert: assertAllowed, consume, issue })
    const base = readCatalog().tools.find((tool) => tool.name === 'erp_module_export')
    if (!base) throw new Error('测试契约缺少 erp_module_export')
    const catalog: ToolCatalog = {
      version: 1,
      tools: [
        {
          ...base,
          dataScope: { resourceKey: 'platform:modules', action: 'export' },
        },
      ],
    }

    await expect(
      registry.invoke(
        {
          ...ACTOR,
          name: 'erp_module_export',
          args: { id: 'mod-1' },
          confirmationToken: 'token-1',
        },
        catalog,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(consume).not.toHaveBeenCalled()
  })
})

describe('isAgentAllowed', () => {
  const { isAgentAllowed } = require('./agent-tool.registry')
  it('enforces allowedAgents', () => {
    expect(isAgentAllowed({ allowedAgents: ['piagent-builder'] }, 'piagent-runtime')).toBe(false)
    expect(isAgentAllowed({ allowedAgents: ['piagent-builder'] }, 'piagent-builder')).toBe(true)
    expect(isAgentAllowed({}, 'piagent-runtime')).toBe(true)
  })
})
