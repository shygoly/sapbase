/**
 * 端到端：**插件在受限子进程里跑，越权经真实 HTTP 被拒**。
 *
 * 三件事：
 *   1. 合规插件（纯计算 + 声明内的日志）经 HTTP 调用正常返回
 *   2. 试图读文件的插件经 HTTP 调用被拒（422 + ERR_ACCESS_DENIED），**没有结果返回**
 *   3. `hostApiVersion` 不匹配的插件被拒装（清单协议先于插件能力生效）
 *
 * 前置：本地 PostgreSQL 有 `sapbase_rebuild`（`npx ts-node --transpile-only
 * scripts/rebuild-database.ts --db=sapbase_rebuild`）。**没有任何表时自动跳过并说明原因**。
 */
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import request from 'supertest'
import { mkdtempSync, rmSync } from 'node:fs'
import AdmZip from 'adm-zip'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PluginsModule } from '../src/plugins/plugins.module'
import { EventBusModule } from '../src/common/events/event-bus.module'
import { PluginRuntimeService } from '../src/plugins/infrastructure/runtime/plugin-runtime.service'
import { PluginLifecycleService } from '../src/plugins/application/services/plugin-lifecycle.service'
import { PluginLoaderService } from '../src/plugins/infrastructure/services/plugin-loader.service'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'
import { Plugin as PluginOrm } from '../src/plugins/infrastructure/persistence/plugin.entity'

const ORGANIZATION_ID = '44444444-4444-4444-4444-444444444444'

/**
 * 造一个真实插件**包**（`.zip`：`manifest.json` + 入口）。
 *
 * 注意是 zip 不是目录：安装路径的 `loadManifest` 用 AdmZip 读 `manifest.json`，
 * 之后再把包解到 installPath —— 这两步都是生产代码走过的路。
 */
function makePluginZip(manifest: Record<string, unknown>, entrySource: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'speckit-e2e-plugin-'))
  const zip = new AdmZip()
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)))
  zip.addFile('index.js', Buffer.from(entrySource))
  const zipPath = join(dir, 'plugin.zip')
  zip.writeZip(zipPath)
  return dir
}

const COMPLIANT_MANIFEST = {
  name: 'compliant-plugin',
  version: '1.0.0',
  hostApiVersion: 1,
  type: 'integration',
  permissions: {},
  entry: { backend: 'index.js' },
}

const COMPLIANT_ENTRY = `
let context = null
module.exports = {
  initialize: (ctx) => { context = ctx },
  compute: (a, b) => a + b,
  sayHi: async () => {
    await context.log('hello from plugin')
    return 'hi'
  },
}
`

const LEAKY_MANIFEST = {
  name: 'leaky-plugin',
  version: '1.0.0',
  hostApiVersion: 1,
  type: 'integration',
  permissions: {},
  entry: { backend: 'index.js' },
}

const LEAKY_ENTRY = `
module.exports = {
  readSecret: () => require('node:fs').readFileSync('/etc/hosts', 'utf8'),
}
`

describe('插件沙箱（e2e，真实 HTTP + 真实受限子进程）', () => {
  let app: INestApplication
  let dataSource: DataSource
  let available = true
  const dirs: string[] = []

  const dir = (manifest: Record<string, unknown>, entry: string) => {
    const created = makePluginZip(manifest, entry)
    dirs.push(created)
    return join(created, 'plugin.zip')
  }

  async function installAndActivate(
    lifecycle: PluginLifecycleService,
    pluginDir: string,
    name: string,
  ) {
    // install 走服务层（HTTP 那条路要 multipart + 组织上下文，属控制面；
    // 本用例的重点是"调用经 HTTP 时的边界"）
    const plugin = await lifecycle.install({
      zipPath: pluginDir,
      organizationId: ORGANIZATION_ID,
    })
    const full = await lifecycle.activate({
      pluginId: plugin.id,
      organizationId: ORGANIZATION_ID,
    })
    return full
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USERNAME || 'mac',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME || 'sapbasic',
          entities: [join(__dirname, '../src/**/*.entity.ts')],
          synchronize: false,
        }),
        EventBusModule,
        PluginsModule,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { user?: Record<string, unknown> } }
        }) => {
          context.switchToHttp().getRequest().user = {
            id: 'e2e-user',
            userId: 'e2e-user',
            email: 'e2e@test.local',
            organizationId: ORGANIZATION_ID,
          }
          return true
        },
      })
      .compile()

    app = moduleRef.createNestApplication()
    await app.init()
    dataSource = moduleRef.get(DataSource)

    try {
      await dataSource.query('SELECT 1 FROM plugins LIMIT 1')
      await dataSource.query(
        `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
         VALUES ($1, 'e2e-plugin', 'e2e-plugin', 'active', now(), now())
         ON CONFLICT (id) DO NOTHING`,
        [ORGANIZATION_ID],
      )
    } catch {
      available = false
    }
  }, 60000)

  afterAll(async () => {
    if (dataSource?.isInitialized && available) {
      await dataSource.query('DELETE FROM plugins WHERE "organizationId" = $1', [ORGANIZATION_ID])
      await dataSource.query('DELETE FROM organizations WHERE id = $1', [ORGANIZATION_ID])
    }
    await app?.close()
    for (const created of dirs) rmSync(created, { recursive: true, force: true })
  })

  it('合规插件：经 HTTP 调用返回结果（它在受限子进程里跑）', async () => {
    if (!available) {
      console.warn('跳过 e2e：本地库缺少 plugins 表（先重建库）')
      return
    }
    const server = app.getHttpServer()
    const lifecycle = app.get(PluginLifecycleService)
    const plugin = await installAndActivate(
      lifecycle,
      dir(COMPLIANT_MANIFEST, COMPLIANT_ENTRY),
      'compliant-plugin',
    )

    const computed = await request(server)
      .post(`/plugins/${plugin.id}/invoke`)
      .send({ handler: 'compute', args: [2, 3] })
      .expect(200)
    expect(computed.body.result).toBe(5)

    // 走一次能力中介允许的那条（log.write 不需要声明）
    const hi = await request(server)
      .post(`/plugins/${plugin.id}/invoke`)
      .send({ handler: 'sayHi' })
      .expect(200)
    expect(hi.body.result).toBe('hi')
  }, 60000)

  it('越权插件：读文件经 HTTP 调用被拒（422 + ERR_ACCESS_DENIED），不返回结果', async () => {
    if (!available) return
    const server = app.getHttpServer()
    const lifecycle = app.get(PluginLifecycleService)
    const plugin = await installAndActivate(
      lifecycle,
      dir(LEAKY_MANIFEST, LEAKY_ENTRY),
      'leaky-plugin',
    )

    const denied = await request(server)
      .post(`/plugins/${plugin.id}/invoke`)
      .send({ handler: 'readSecret' })
      .expect(422)

    expect(denied.body.code).toBe('ERR_ACCESS_DENIED')
    // 拒绝就是拒绝：没有任何"结果"字段被返回
    expect(denied.body.result).toBeUndefined()
  }, 60000)

  it('hostApiVersion 不匹配 → 拒装（协议先于能力生效）', async () => {
    if (!available) return
    const loader = app.get(PluginLoaderService)
    const manifest = {
      ...COMPLIANT_MANIFEST,
      name: 'future-plugin',
      hostApiVersion: 2,
    }

    // 清单校验不通过 → 拒装（这里直接对校验器断言，避免依赖 multipart 细节）
    await expect(
      loader.validateManifest(manifest as never),
    ).rejects.toThrow(/hostApiVersion|Invalid manifest/)
  })

  it('未激活的插件不提供调用入口（404 而不是静默成功）', async () => {
    if (!available) return
    await request(app.getHttpServer())
      .post('/plugins/does-not-exist/invoke')
      .send({ handler: 'compute' })
      .expect(404)
  })

  it('运行时不许留孤儿进程：关停时把活着的插件进程都收掉', async () => {
    if (!available) return
    const runtime = app.get(PluginRuntimeService)
    const before = runtime.getAllRuntimes().length
    await runtime.onModuleDestroy()
    expect(runtime.getAllRuntimes()).toHaveLength(0)
    expect(before).toBeGreaterThan(0)
  })
})
