/**
 * C2.5 工具面 + 授权路径 e2e（真 Postgres）。
 *
 * 骨架照抄 `currency-permissions.e2e-spec.ts`：60s 超时、最小 TestingModule、
 * JwtAuthGuard 注入可改的 currentUser、无库 skip 并给理由、beforeAll 幂等应用 DDL。
 * `AGENT_CONFIRMATION_TOKENS_DDL` 在这里是第三处消费。
 */
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AgentToolsModule } from '../src/agent-tools/agent-tools.module'
import { AGENT_CONFIRMATION_TOKENS_DDL } from '../src/agent-tools/confirmation-token.ddl'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'
import { UsersModule } from '../src/users/users.module'

const ORGANIZATION_ID = '25252525-2525-4252-8252-252525252525'
const MODULE_ID = '26262626-2626-4262-8262-262626262626'
const EMAIL_PREFIX = 'c25-'

function httpMessage(body: { message?: string | string[] }): string {
  const message = body.message
  return Array.isArray(message) ? message.join(' | ') : String(message ?? '')
}

describe('Agent tools + 授权路径（C2.5 e2e）', () => {
  jest.setTimeout(60000)

  let app: INestApplication
  let dataSource: DataSource
  let available = true
  let exportDir: string
  let packagesDir: string

  const currentUser: {
    id: string
    userId: string
    email: string
    role: string
    organizationId: string
    permissions: string[]
  } = {
    id: 'e2e-c25-user',
    userId: 'e2e-c25-user',
    email: 'c25-actor@test.local',
    role: 'Admin',
    organizationId: ORGANIZATION_ID,
    permissions: ['tool:module:read', 'tool:module:export', 'tool:blueprint:read'],
  }

  const server = () => app.getHttpServer()

  async function toolAudits(): Promise<
    Array<{
      action: string
      status: string
      organizationId: string
      metadata: {
        tool?: string
        argsDigest?: string
        organizationId?: string
        reason?: string
      }
    }>
  > {
    return dataSource.query(
      `SELECT action, status, "organizationId", metadata
         FROM audit_logs
        WHERE action = 'chat.tool.invoked' AND "organizationId" = $1`,
      [ORGANIZATION_ID],
    )
  }

  beforeAll(async () => {
    exportDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-c25-export-'))
    packagesDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-c25-pkgs-'))
    process.env.BLUEPRINT_PACKAGES_DIR = packagesDir

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
        AgentToolsModule,
        UsersModule,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { user?: Record<string, unknown> } }
        }) => {
          context.switchToHttp().getRequest().user = { ...currentUser }
          return true
        },
      })
      .compile()

    app = moduleRef.createNestApplication()
    // 与 main.ts 同一条全局管道：授权路径负例要靠它拒非法 permissions。
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    await app.init()
    dataSource = moduleRef.get(DataSource)

    try {
      await dataSource.query('SELECT 1 FROM organizations LIMIT 1')
      for (const statement of AGENT_CONFIRMATION_TOKENS_DDL) {
        await dataSource.query(statement)
      }
    } catch (error) {
      available = false
      console.warn(`跳过 e2e：本地库不可用（${(error as Error).message}）`)
      return
    }

    await dataSource.query(
      `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
       VALUES ($1, 'e2e-c25', 'e2e-c25', 'active', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [ORGANIZATION_ID],
    )
    await dataSource.query(`DELETE FROM agent_confirmation_tokens WHERE "organizationId" = $1`, [
      ORGANIZATION_ID,
    ]).catch(() => undefined)
    await dataSource.query(
      `DELETE FROM audit_logs WHERE action = 'chat.tool.invoked' AND "organizationId" = $1`,
      [ORGANIZATION_ID],
    ).catch(() => undefined)
    await dataSource.query(`DELETE FROM module_registry WHERE "organizationId" = $1`, [
      ORGANIZATION_ID,
    ]).catch(() => undefined)
    await dataSource.query(`DELETE FROM users WHERE email LIKE $1`, [`${EMAIL_PREFIX}%`]).catch(
      () => undefined,
    )

    await dataSource.query(
      `INSERT INTO module_registry
        (id, "createdAt", "updatedAt", "organizationId", name, version, status, "moduleType", "dependsOnAtomics", metadata)
       VALUES
        ($1, now(), now(), $2, 'e2e-c25-module', '1.0.0', 'active', 'crud', '[]'::jsonb, $3::jsonb)`,
      [MODULE_ID, ORGANIZATION_ID, JSON.stringify({ entities: ['Probe'] })],
    )
  })

  afterAll(async () => {
    if (dataSource?.isInitialized && available) {
      await dataSource.query(`DELETE FROM agent_confirmation_tokens WHERE "organizationId" = $1`, [
        ORGANIZATION_ID,
      ]).catch(() => undefined)
      await dataSource.query(
        `DELETE FROM audit_logs WHERE action = 'chat.tool.invoked' AND "organizationId" = $1`,
        [ORGANIZATION_ID],
      ).catch(() => undefined)
      await dataSource.query(`DELETE FROM module_registry WHERE "organizationId" = $1`, [
        ORGANIZATION_ID,
      ]).catch(() => undefined)
      await dataSource.query(`DELETE FROM users WHERE email LIKE $1`, [`${EMAIL_PREFIX}%`]).catch(
        () => undefined,
      )
    }
    if (app) await app.close()
    if (exportDir) rmSync(exportDir, { recursive: true, force: true })
    if (packagesDir) rmSync(packagesDir, { recursive: true, force: true })
  })

  afterEach(async () => {
    currentUser.id = 'e2e-c25-user'
    currentUser.userId = 'e2e-c25-user'
    currentUser.email = 'c25-actor@test.local'
    currentUser.role = 'Admin'
    currentUser.organizationId = ORGANIZATION_ID
    currentUser.permissions = ['tool:module:read', 'tool:module:export', 'tool:blueprint:read']
    if (available && dataSource?.isInitialized) {
      await dataSource.query(
        `DELETE FROM audit_logs WHERE action = 'chat.tool.invoked' AND "organizationId" = $1`,
        [ORGANIZATION_ID],
      ).catch(() => undefined)
    }
  })

  it('GET /agent-tools → 200，返回契约原文（6 个工具，各带 permission）', async () => {
    if (!available) return
    const listed = await request(server()).get('/agent-tools').expect(200)
    expect(listed.body.version).toBe(1)
    expect(listed.body.tools).toHaveLength(6)
    const names = listed.body.tools.map((tool: { name: string }) => tool.name)
    expect(names).toEqual([
      'erp_blueprint_list',
      'erp_blueprint_manifest',
      'erp_blueprint_compile',
      'erp_atomic_invoke',
      'erp_module_list',
      'erp_module_export',
    ])
    for (const tool of listed.body.tools as Array<{ permission: string }>) {
      expect(tool.permission).toMatch(/^tool:/)
    }
  })

  it('未知工具 → 404「没有这个能力」，且不写审计', async () => {
    if (!available) return
    const denied = await request(server())
      .post('/agent-tools/erp_not_a_capability/invoke')
      .send({ args: {} })
      .expect(404)
    expect(httpMessage(denied.body)).toMatch(/没有这个能力/)
    expect(await toolAudits()).toHaveLength(0)
  })

  it('越权 → 403，写明缺哪条权限点，且不写审计', async () => {
    if (!available) return
    currentUser.permissions = ['tool:module:read']
    const denied = await request(server())
      .post('/agent-tools/erp_module_export/invoke')
      .send({ args: { id: MODULE_ID, dir: exportDir } })
      .expect(403)
    expect(httpMessage(denied.body)).toContain('tool:module:export')
    expect(await toolAudits()).toHaveLength(0)
  })

  it('写工具无令牌 → 403，且导出没有真的发生', async () => {
    if (!available) return
    const isolated = mkdtempSync(join(tmpdir(), 'speckit-e2e-c25-notoken-'))
    try {
      const denied = await request(server())
        .post('/agent-tools/erp_module_export/invoke')
        .send({ args: { id: MODULE_ID, dir: isolated } })
        .expect(403)
      expect(httpMessage(denied.body)).toMatch(/确认令牌/)
      expect(readdirSync(isolated)).toEqual([])
    } finally {
      rmSync(isolated, { recursive: true, force: true })
    }
  })

  it('签发确认令牌 → 200，库里多一行且 consumedAt IS NULL', async () => {
    if (!available) return
    const confirmed = await request(server())
      .post('/agent-tools/erp_module_export/confirm')
      .send({ args: { id: MODULE_ID, dir: exportDir, out: join(exportDir, 'probe.erpkg') } })
      .expect(200)
    expect(confirmed.body.token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    const rows: Array<{ consumedAt: Date | null }> = await dataSource.query(
      `SELECT "consumedAt" FROM agent_confirmation_tokens WHERE id = $1`,
      [confirmed.body.token],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].consumedAt).toBeNull()
  })

  it('真库一次性：invoke 成功后 consumedAt 非空，同一令牌二次消费必拒', async () => {
    if (!available) return
    const dir = mkdtempSync(join(tmpdir(), 'speckit-e2e-c25-once-'))
    const out = join(dir, 'probe.erpkg')
    const args = { id: MODULE_ID, dir, out }
    try {
      const confirmed = await request(server())
        .post('/agent-tools/erp_module_export/confirm')
        .send({ args })
        .expect(200)

      const first = await request(server())
        .post('/agent-tools/erp_module_export/invoke')
        .send({ args, confirmationToken: confirmed.body.token })
        .expect(200)
      expect(first.body.ok).toBe(true)
      expect(first.body.tool).toBe('erp_module_export')
      expect(readdirSync(dir).length).toBeGreaterThan(0)

      const consumed: Array<{ consumedAt: Date | null }> = await dataSource.query(
        `SELECT "consumedAt" FROM agent_confirmation_tokens WHERE id = $1`,
        [confirmed.body.token],
      )
      expect(consumed[0].consumedAt).not.toBeNull()

      const replay = await request(server())
        .post('/agent-tools/erp_module_export/invoke')
        .send({ args, confirmationToken: confirmed.body.token })
        .expect(403)
      expect(httpMessage(replay.body)).toMatch(/已用|已失效|无效/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('参数摘要不匹配：为 args A 签发，用 args B invoke → 403', async () => {
    if (!available) return
    const dir = mkdtempSync(join(tmpdir(), 'speckit-e2e-c25-digest-'))
    try {
      const argsA = { id: MODULE_ID, dir, out: join(dir, 'a.erpkg') }
      const argsB = { id: MODULE_ID, dir, out: join(dir, 'b.erpkg') }
      const confirmed = await request(server())
        .post('/agent-tools/erp_module_export/confirm')
        .send({ args: argsA })
        .expect(200)
      const denied = await request(server())
        .post('/agent-tools/erp_module_export/invoke')
        .send({ args: argsB, confirmationToken: confirmed.body.token })
        .expect(403)
      expect(httpMessage(denied.body)).toMatch(/参数不匹配|已失效|无效/)
      expect(readdirSync(dir)).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('过期令牌：把 expiresAt 改到过去后再 invoke → 403', async () => {
    if (!available) return
    const dir = mkdtempSync(join(tmpdir(), 'speckit-e2e-c25-exp-'))
    const args = { id: MODULE_ID, dir, out: join(dir, 'expired.erpkg') }
    try {
      const confirmed = await request(server())
        .post('/agent-tools/erp_module_export/confirm')
        .send({ args })
        .expect(200)
      await dataSource.query(
        `UPDATE agent_confirmation_tokens
            SET "expiresAt" = now() - interval '1 minute'
          WHERE id = $1`,
        [confirmed.body.token],
      )
      const denied = await request(server())
        .post('/agent-tools/erp_module_export/invoke')
        .send({ args, confirmationToken: confirmed.body.token })
        .expect(403)
      expect(httpMessage(denied.body)).toMatch(/已失效|无效|过期/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('成功调用落审计：恰好一条 chat.tool.invoked / success，租户不在 metadata', async () => {
    if (!available) return
    await request(server()).post('/agent-tools/erp_module_list/invoke').send({ args: {} }).expect(200)
    const rows = await toolAudits()
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('success')
    expect(rows[0].organizationId).toBe(ORGANIZATION_ID)
    expect(rows[0].metadata.tool).toBe('erp_module_list')
    expect(typeof rows[0].metadata.argsDigest).toBe('string')
    expect(rows[0].metadata.argsDigest).toHaveLength(64)
    expect(rows[0].metadata.organizationId).toBeUndefined()
  })

  it('失败也落审计：执行路径抛错 → status=failure 带 reason', async () => {
    if (!available) return
    await request(server())
      .post('/agent-tools/erp_blueprint_manifest/invoke')
      .send({ args: { id: 'definitely-not-a-package' } })
      .expect(404)
    const rows = await toolAudits()
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('failure')
    expect(rows[0].metadata.tool).toBe('erp_blueprint_manifest')
    expect(rows[0].metadata.reason).toMatch(/蓝图包不存在|definitely-not-a-package/)
    expect(rows[0].metadata.organizationId).toBeUndefined()
  })

  it('授权路径真库往返：PUT 授予 permissions，simple-array 列与读回一致', async () => {
    if (!available) return
    const email = `${EMAIL_PREFIX}${randomUUID()}@test.local`
    const created = await request(server())
      .post('/users')
      .send({
        name: 'C25 Grant Target',
        email,
        password: 'password12',
      })
      .expect(201)
    const userId = created.body.data.id as string
    expect(userId).toBeTruthy()

    const granted = ['tool:module:read', 'tool:module:export']
    const updated = await request(server())
      .put(`/users/${userId}`)
      .send({ permissions: granted })
      .expect(200)
    expect(updated.body.data.permissions).toEqual(granted)

    const raw: Array<{ permissions: string }> = await dataSource.query(
      `SELECT permissions FROM users WHERE id = $1`,
      [userId],
    )
    expect(raw).toHaveLength(1)
    expect(raw[0].permissions).toBe(granted.join(','))

    const readBack = await request(server()).get(`/users/${userId}`).expect(200)
    expect(readBack.body.data.permissions).toEqual(granted)
  })

  it('授权路径负例：permissions 不是 string[] → 400', async () => {
    if (!available) return
    const email = `${EMAIL_PREFIX}${randomUUID()}@test.local`
    const created = await request(server())
      .post('/users')
      .send({
        name: 'C25 Reject Target',
        email,
        password: 'password12',
      })
      .expect(201)
    const userId = created.body.data.id as string

    const asString = await request(server())
      .put(`/users/${userId}`)
      .send({ permissions: 'tool:module:read' })
      .expect(400)
    expect(httpMessage(asString.body).toLowerCase()).toMatch(/array|each|string/)

    const asNumbers = await request(server())
      .put(`/users/${userId}`)
      .send({ permissions: [123] })
      .expect(400)
    expect(httpMessage(asNumbers.body).toLowerCase()).toMatch(/string/)
  })
})
