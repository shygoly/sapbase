// 闸：插件受限子进程边界。
//
// 这个文件要证明的不是"代码写了 boundary 这个词"，而是三件可复现的事：
//   1. 探测得到权限模型 → 放行；探测不到 → **拒绝加载**（不退回同进程）
//   2. 子进程里 fs / child_process / worker_threads 三条路**实测被拒**（ERR_ACCESS_DENIED）
//   3. 插件的宿主能力请求走判定者：缺声明即拒，且拒绝理由回给插件、写进审计
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  PluginHostError,
  PluginHostProcess,
  hostEntryPath,
  isPermissionModelAvailable,
} from './plugin-host-process'
import { createAuthorizer } from '../security/plugin-capability-broker'

/** 造一个插件目录：`index.js` + 可选内容。 */
function makePlugin(source: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'speckit-plugin-'))
  writeFileSync(join(dir, 'index.js'), source)
  return dir
}

const dirs: string[] = []
let hosts: PluginHostProcess[] = []

function pluginWith(source: string): string {
  const dir = makePlugin(source)
  dirs.push(dir)
  return dir
}

function startHost(pluginDir: string, overrides: Partial<{ timeoutMs: number }> = {}) {
  const host = new PluginHostProcess({
    pluginDir,
    entry: 'index.js',
    pluginName: 'test-plugin',
    timeoutMs: overrides.timeoutMs ?? 3000,
  })
  hosts.push(host)
  return host
}

afterEach(async () => {
  for (const host of hosts) await host.stop()
  hosts = []
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs.length = 0
})

describe('探测与 fail-closed', () => {
  it('本机 Node 支持权限模型 → 探测为真', () => {
    expect(isPermissionModelAvailable()).toBe(true)
  })

  it('不认 --permission 的运行时 → 探测为假（而不是"试试看"）', () => {
    expect(isPermissionModelAvailable('/nonexistent-node-binary')).toBe(false)
  })

  it('宿主入口可定位（ts-jest 下是 .ts，构建后是 .js）', () => {
    expect(hostEntryPath()).toMatch(/plugin-host-entry\.(ts|js)$/)
  })

  it('探测失败即拒绝加载，且**不**退回同进程 require', async () => {
    const dir = pluginWith('module.exports = { ping: () => "pong" }')
    // 用一个"不认 --permission 的假 node"模拟不支持权限模型的运行时
    const host = new PluginHostProcess({
      pluginDir: dir,
      entry: 'index.js',
      pluginName: 'test-plugin',
      nodeBinary: '/nonexistent-node-binary',
    })
    hosts.push(host)

    await expect(host.start()).rejects.toMatchObject({
      name: 'PluginHostError',
      code: 'PERMISSION_MODEL_UNAVAILABLE',
    })
    // 拒绝就是拒绝：进程没有在宿主进程里被 require 起来
    expect(host.running).toBe(false)
  })
})

describe('边界：三条越权路实测被拒', () => {
  it('读文件被拒（ERR_ACCESS_DENIED）', async () => {
    const dir = pluginWith(`
      module.exports = {
        tryRead: () => {
          const fs = require('node:fs')
          fs.readFileSync('/etc/hosts')
          return 'READ_OK'
        },
      }
    `)
    const host = startHost(dir)
    await host.start()

    const result = await host.invoke('tryRead')

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('ERR_ACCESS_DENIED')
  })

  it('起子进程被拒（ERR_ACCESS_DENIED）', async () => {
    const dir = pluginWith(`
      module.exports = {
        tryExec: () => require('node:child_process').execSync('echo pwned').toString(),
      }
    `)
    const host = startHost(dir)
    await host.start()

    const result = await host.invoke('tryExec')

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('ERR_ACCESS_DENIED')
  })

  it('起 worker 被拒（ERR_ACCESS_DENIED）', async () => {
    const dir = pluginWith(`
      module.exports = {
        tryWorker: () => {
          const { Worker } = require('node:worker_threads')
          new Worker('', { eval: true })
          return 'WORKER_OK'
        },
      }
    `)
    const host = startHost(dir)
    await host.start()

    const result = await host.invoke('tryWorker')

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('ERR_ACCESS_DENIED')
  })

  it('合规插件照常工作（边界不是"什么都干不了"）', async () => {
    const dir = pluginWith(`
      let context = null
      module.exports = {
        initialize: (ctx) => { context = ctx },
        compute: (a, b) => a + b,
        askHost: (table) => context.query(table),
      }
    `)
    const host = new PluginHostProcess({
      pluginDir: dir,
      entry: 'index.js',
      pluginName: 'test-plugin',
      authorize: (_capability, args) =>
        args.table === 'orders' ? null : '缺少声明：database.tables 不含 ' + String(args.table),
      executeCapability: async (capability, args) => ({ via: capability, table: args.table }),
    })
    hosts.push(host)
    await host.start()

    await expect(host.invoke('compute', [2, 3])).resolves.toMatchObject({ ok: true, result: 5 })
    await expect(host.invoke('askHost', ['orders'])).resolves.toMatchObject({
      ok: true,
      result: { via: 'database.read', table: 'orders' },
    })
  })
})

describe('能力中介：判定权在平台', () => {
  it('缺声明 → 请求被拒，理由是"缺哪条声明"，且写进审计', async () => {
    const dir = pluginWith(`
      let context = null
      module.exports = {
        initialize: (ctx) => { context = ctx },
        askHost: (table) => context.query(table).then(() => 'ALLOWED').catch((error) => 'DENIED: ' + error.message),
      }
    `)
    const audits: Array<Record<string, unknown>> = []
    const host = new PluginHostProcess({
      pluginDir: dir,
      entry: 'index.js',
      pluginName: 'test-plugin',
      authorize: (_capability, args) =>
        args.table === 'orders' ? null : '缺少声明：database.tables 不含 ' + String(args.table),
      executeCapability: async () => ({ ok: true }),
      onAudit: (event) => audits.push(event),
    })
    hosts.push(host)
    await host.start()

    await expect(host.invoke('askHost', ['customers'])).resolves.toMatchObject({
      ok: true,
      result: 'DENIED: 缺少声明：database.tables 不含 customers',
    })
    expect(audits).toContainEqual({
      action: 'plugin.capability.denied',
      capability: 'database.read',
      allowed: false,
      reason: '缺少声明：database.tables 不含 customers',
    })
  })
})

describe('与能力中介对接（判定来自 broker，不是测试里的假审核）', () => {
  it('清单只声明 orders → 访问 customers 被 broker 拒绝，理由与审计都在', async () => {
    const dir = pluginWith(`
      let context = null
      module.exports = {
        initialize: (ctx) => { context = ctx },
        readCustomers: () =>
          context.query('customers').then(() => 'ALLOWED').catch((error) => error.message),
        readOrders: () => context.query('orders').then((rows) => rows),
      }
    `)
    const audits: Array<Record<string, unknown>> = []
    const host = new PluginHostProcess({
      pluginDir: dir,
      entry: 'index.js',
      pluginName: 'auto-parts',
      // 判定者来自能力中介：清单只声明了 orders 的读权限
      authorize: createAuthorizer('auto-parts', {
        database: { tables: ['orders'], operations: ['read'] },
      }),
      executeCapability: async (_capability, args) => ({ table: args.table, rows: [] }),
      onAudit: (event) => audits.push(event),
    })
    hosts.push(host)
    await host.start()

    await expect(host.invoke('readOrders')).resolves.toMatchObject({
      ok: true,
      result: { table: 'orders', rows: [] },
    })

    const denied = await host.invoke('readCustomers')
    expect(denied.ok).toBe(true) // 插件自己 catch 了，宿主侧的调用本身是成功的
    expect(String(denied.result)).toContain('PLUGIN_CAPABILITY_DENIED')
    expect(String(denied.result)).toContain('db:customers:read')

    expect(audits).toContainEqual({
      action: 'plugin.capability.denied',
      capability: 'database.read',
      allowed: false,
      reason: expect.stringContaining('db:customers:read'),
    })
  })
})

describe('进程生命周期', () => {
  it('超时 → 终止进程并报 TIMEOUT（不回退、不挂死）', async () => {
    const dir = pluginWith(`
      module.exports = {
        hang: () => {
          while (true) {}
        },
      }
    `)
    const host = startHost(dir)
    await host.start()

    const result = await host.invoke('hang')

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('TIMEOUT')
    expect(host.running).toBe(false)
  }, 15000)

  it('调用不存在的导出 → 明确的错误，而不是静默成功', async () => {
    const dir = pluginWith('module.exports = { known: () => 1 }')
    const host = startHost(dir)
    await host.start()

    const result = await host.invoke('unknown')

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe('NO_SUCH_HANDLER')
  })
})
