// 清单协议：形状 + 跨字段判据。
//
// 负例是重点 —— 清单是插件能力的**唯一来源**，放过一个畸形清单，
// 后面所有"按声明判定"的能力都建立在假前提上。
import { validatePluginManifest } from './plugin-manifest-validator'

const VALID = {
  name: 'auto-parts-forecast',
  version: '1.2.0',
  hostApiVersion: 1,
  type: 'integration',
  entry: { backend: 'dist/index.js' },
  permissions: {
    database: { tables: ['orders'], operations: ['read'] },
    api: { endpoints: ['/api/orders'], methods: ['GET'] },
  },
  routes: [{ path: '/api/orders', method: 'GET', handler: 'getOrders' }],
}

describe('validatePluginManifest', () => {
  it('接受一份完整清单', () => {
    expect(validatePluginManifest(VALID)).toEqual({ valid: true, errors: [] })
  })

  it('缺省 hostApiVersion 视为 1（可选）', () => {
    const { hostApiVersion, ...withoutHostApi } = VALID
    void hostApiVersion
    expect(validatePluginManifest(withoutHostApi).valid).toBe(true)
  })

  it.each([
    ['未知字段（协议是封闭的）', { ...VALID, unexpected: true }, 'unexpected'],
    ['name 不是 kebab-case', { ...VALID, name: 'Auto_Parts' }, 'name'],
    ['version 不是 semver', { ...VALID, version: 'v1.2' }, 'version'],
    ['hostApiVersion 不是宿主支持的 1', { ...VALID, hostApiVersion: 2 }, 'hostApiVersion'],
    ['未知的能力键', { ...VALID, permissions: { network: {} } }, 'permissions'],
    ['entry 缺 backend', { ...VALID, entry: { frontend: 'ui.js' } }, 'entry'],
    ['入口不是 JS 文件', { ...VALID, entry: { backend: 'index.py' } }, 'entry.backend'],
    ['入口是绝对路径', { ...VALID, entry: { backend: '/etc/passwd.js' } }, 'entry.backend'],
    ['入口越出插件目录', { ...VALID, entry: { backend: '../../evil.js' } }, 'entry.backend'],
  ])('拒绝：%s', (_label, manifest, field) => {
    const result = validatePluginManifest(manifest)
    expect(result.valid).toBe(false)
    expect(result.errors.join('; ')).toContain(field)
  })

  it('跨字段：声明了 operations 却没有 tables → 拒（能操作什么必须明确）', () => {
    const result = validatePluginManifest({
      ...VALID,
      permissions: { database: { operations: ['read'] } },
    })
    expect(result.valid).toBe(false)
    expect(result.errors.join('; ')).toContain('没有 tables')
  })

  it('跨字段：路由必须已在 endpoints 里声明（插件不能注册自己没声明过的端点）', () => {
    const result = validatePluginManifest({
      ...VALID,
      routes: [{ path: '/api/secret', method: 'GET', handler: 'peek' }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors.join('; ')).toContain('/api/secret')
  })

  // 这一条被 **Schema 的 pattern** 挡住（`(?!.*\.\.)`），而不是跨字段判据 ——
  // 两道都留着：pattern 拦显式写法，跨字段判据拦路径语义（两者重叠是故意的纵深）
  it('`..` 即使写法隐蔽（a/./../b.js）也被判出来（Schema pattern 先拦）', () => {
    const result = validatePluginManifest({
      ...VALID,
      entry: { backend: 'a/./../b.js' },
    })
    expect(result.valid).toBe(false)
    expect(result.errors.join('; ')).toContain('entry.backend')
  })
})
