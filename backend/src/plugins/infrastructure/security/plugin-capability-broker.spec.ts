// 能力中介：清单声明 → all-of 判定 → 拒绝时写明缺哪条声明。
//
// 这里的负例是重点：**未声明即拿不到**，而且"缺哪条"必须可指名 ——
// 一句"权限不足"对插件作者毫无用处，对排查越权也没有证据价值。
import {
  PLUGIN_CAPABILITY_DENIED,
  PluginCapabilityError,
  assertCapability,
  checkCapability,
  createAuthorizer,
  permissionPointsOf,
  requiredPointsFor,
} from './plugin-capability-broker'

describe('归一：结构化声明 → 权限点', () => {
  it('表 × 操作摊平成逐项权限点', () => {
    expect(
      permissionPointsOf({
        database: { tables: ['orders', 'customers'], operations: ['read', 'write'] },
      }),
    ).toEqual([
      'db:orders:read',
      'db:orders:write',
      'db:customers:read',
      'db:customers:write',
    ])
  })

  it('端点 × 方法摊平（方法统一大写）', () => {
    expect(
      permissionPointsOf({ api: { endpoints: ['/api/orders'], methods: ['get', 'POST'] } }),
    ).toEqual(['api:GET:/api/orders', 'api:POST:/api/orders'])
  })

  it('模块扩展与新建', () => {
    expect(permissionPointsOf({ modules: { extend: ['crm'], create: true } })).toEqual([
      'modules:extend:crm',
      'modules:create',
    ])
  })

  it('只声明了 tables 没声明 operations → 拿不到任何数据权限（不是"默认只读"）', () => {
    expect(permissionPointsOf({ database: { tables: ['orders'] } })).toEqual([])
  })
})

describe('请求 → 所需权限点', () => {
  it.each([
    ['database.read', { table: 'orders' }, ['db:orders:read']],
    ['database.write', { table: 'orders' }, ['db:orders:write']],
    ['api.call', { path: '/api/orders', method: 'post' }, ['api:POST:/api/orders']],
    ['modules.extend', { name: 'crm' }, ['modules:extend:crm']],
    ['modules.create', {}, ['modules:create']],
    ['log.write', { message: 'hi' }, []],
  ])('%s', (capability, args, expected) => {
    expect(requiredPointsFor(capability, args)).toEqual(expected)
  })

  it('未知能力 → 归成不可能满足的点（一律拒，而不是放过）', () => {
    expect(requiredPointsFor('fs.read', { path: '/etc/hosts' })).toEqual(['unknown:fs.read'])
    expect(checkCapability({}, 'fs.read', {}).allowed).toBe(false)
  })
})

describe('判定：all-of', () => {
  const declaration = {
    database: { tables: ['orders'], operations: ['read'] },
    api: { endpoints: ['/api/orders'], methods: ['GET'] },
  }

  it('命中即放行', () => {
    expect(checkCapability(declaration, 'database.read', { table: 'orders' })).toEqual({
      allowed: true,
      missing: [],
    })
  })

  it('未声明的表 → 拒绝，并指名缺的点', () => {
    expect(checkCapability(declaration, 'database.read', { table: 'customers' })).toEqual({
      allowed: false,
      missing: ['db:customers:read'],
    })
  })

  it('表已声明但操作未声明 → 同样拒绝（读权限不等于写权限）', () => {
    expect(checkCapability(declaration, 'database.write', { table: 'orders' })).toEqual({
      allowed: false,
      missing: ['db:orders:write'],
    })
  })

  it('方法未声明 → 拒绝（GET 不等于 POST）', () => {
    expect(
      checkCapability(declaration, 'api.call', { path: '/api/orders', method: 'POST' }),
    ).toEqual({ allowed: false, missing: ['api:POST:/api/orders'] })
  })

  it('空声明的插件只能做纯计算：任何数据/接口/模块能力都拿不到', () => {
    for (const [capability, args] of [
      ['database.read', { table: 'orders' }],
      ['api.call', { path: '/api/orders', method: 'GET' }],
      ['modules.extend', { name: 'crm' }],
    ] as const) {
      expect(checkCapability({}, capability, args).allowed).toBe(false)
    }
    // 但写日志是允许的（它不改数据、不出网）—— 边界不是"什么都干不了"
    expect(checkCapability({}, 'log.write', { message: 'hi' }).allowed).toBe(true)
  })
})

describe('拒绝要抛得出、说得清', () => {
  it('assertCapability 抛 PLUGIN_CAPABILITY_DENIED 并列出缺失项', () => {
    try {
      assertCapability('auto-parts', { database: { tables: ['orders'], operations: ['read'] } }, 'database.write', {
        table: 'orders',
      })
      throw new Error('本应被拒')
    } catch (error) {
      expect(error).toBeInstanceOf(PluginCapabilityError)
      const denied = error as PluginCapabilityError
      expect(denied.message).toContain(PLUGIN_CAPABILITY_DENIED)
      expect(denied.missing).toEqual(['db:orders:write'])
      expect(denied.message).toContain('未声明即拿不到')
    }
  })

  it('放行时不抛错', () => {
    expect(() =>
      assertCapability('auto-parts', { database: { tables: ['orders'], operations: ['read'] } }, 'database.read', {
        table: 'orders',
      }),
    ).not.toThrow()
  })
})

describe('给子进程宿主用的判定者', () => {
  it('放行返回 null；拒绝返回带缺失项的原因（要回给插件，不是炸宿主）', () => {
    const authorize = createAuthorizer('auto-parts', {
      database: { tables: ['orders'], operations: ['read'] },
    })

    expect(authorize('database.read', { table: 'orders' })).toBeNull()
    expect(authorize('database.read', { table: 'customers' })).toContain('db:customers:read')
    expect(authorize('database.read', { table: 'customers' })).toContain('PLUGIN_CAPABILITY_DENIED')
  })
})
