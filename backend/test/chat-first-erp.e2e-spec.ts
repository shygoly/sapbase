/**
 * C5 端到端：编排 → 工具 → 确认 → 写 → 审计（真 Postgres）。
 *
 * 骨架照抄 `agent-tools.e2e-spec.ts`：60s 超时、最小 TestingModule、
 * JwtAuthGuard 注入可改的 currentUser、无库 skip 并给理由、beforeAll 幂等应用 DDL。
 * 写路径的导出落盘只走 `mkdtempSync`（`BLUEPRINT_EXPORT_DIR` / `BLUEPRINT_PACKAGES_DIR`），
 * 绝不写进仓库。
 */
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import request from 'supertest'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AgentToolsModule } from '../src/agent-tools/agent-tools.module'
import { AGENT_CONFIRMATION_TOKENS_DDL } from '../src/agent-tools/confirmation-token.ddl'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'
import { ChatModule } from '../src/chat/chat.module'
import { validateInteractionPlan } from '../src/chat/chat-protocol-validator'
import type { InteractionPlan, PlanAction } from '../src/chat/chat.types'

const ORGANIZATION_ID = '27272727-2727-4272-8272-272727272727'
const MODULE_ID = '28282828-2828-4282-8282-282828282828'
const ALL_TOOL_PERMISSIONS = ['tool:module:read', 'tool:module:export', 'tool:blueprint:read']

function httpMessage(body: { message?: string | string[] }): string {
  const message = body.message
  return Array.isArray(message) ? message.join(' | ') : String(message ?? '')
}

function confirmAction(plan: InteractionPlan): Extract<PlanAction, { kind: 'confirm' }> {
  const action = plan.actions.find((item) => item.kind === 'confirm')
  if (!action || action.kind !== 'confirm') {
    throw new Error('plan.actions 里没有 kind=confirm')
  }
  return action
}

describe('Chat-first ERP 端到端（C5）', () => {
  jest.setTimeout(60000)

  let app: INestApplication
  let dataSource: DataSource
  let available = true
  let exportDir: string
  let packagesDir: string
  let previousExportDir: string | undefined
  let previousPackagesDir: string | undefined

  const currentUser: {
    id: string
    userId: string
    email: string
    role: string
    organizationId: string
    permissions: string[]
  } = {
    id: 'e2e-c5-user',
    userId: 'e2e-c5-user',
    email: 'c5-actor@test.local',
    role: 'Admin',
    organizationId: ORGANIZATION_ID,
    permissions: [...ALL_TOOL_PERMISSIONS],
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
    previousExportDir = process.env.BLUEPRINT_EXPORT_DIR
    previousPackagesDir = process.env.BLUEPRINT_PACKAGES_DIR
    exportDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-c5-export-'))
    packagesDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-c5-pkgs-'))
    process.env.BLUEPRINT_EXPORT_DIR = exportDir
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
        ChatModule,
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
       VALUES ($1, 'e2e-c5', 'e2e-c5', 'active', now(), now())
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

    await dataSource.query(
      `INSERT INTO module_registry
        (id, "createdAt", "updatedAt", "organizationId", name, version, status, "moduleType", "dependsOnAtomics", metadata)
       VALUES
        ($1, now(), now(), $2, 'e2e-c5-module', '1.0.0', 'active', 'crud', '[]'::jsonb, $3::jsonb)`,
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
    }
    if (app) await app.close()
    if (exportDir) rmSync(exportDir, { recursive: true, force: true })
    if (packagesDir) rmSync(packagesDir, { recursive: true, force: true })
    if (previousExportDir === undefined) delete process.env.BLUEPRINT_EXPORT_DIR
    else process.env.BLUEPRINT_EXPORT_DIR = previousExportDir
    if (previousPackagesDir === undefined) delete process.env.BLUEPRINT_PACKAGES_DIR
    else process.env.BLUEPRINT_PACKAGES_DIR = previousPackagesDir
  })

  afterEach(async () => {
    currentUser.id = 'e2e-c5-user'
    currentUser.userId = 'e2e-c5-user'
    currentUser.email = 'c5-actor@test.local'
    currentUser.role = 'Admin'
    currentUser.organizationId = ORGANIZATION_ID
    currentUser.permissions = [...ALL_TOOL_PERMISSIONS]
    if (available && dataSource?.isInitialized) {
      await dataSource.query(
        `DELETE FROM audit_logs WHERE action = 'chat.tool.invoked' AND "organizationId" = $1`,
        [ORGANIZATION_ID],
      ).catch(() => undefined)
    }
  })

  describe('编排 → 工具 → 确认 → 写 → 审计', () => {
    it('读路径：POST /chat/message「列出模块」→ plan 合法且不需确认', async () => {
      if (!available) return
      const listed = await request(server())
        .post('/chat/message')
        .send({ message: '列出模块' })
        .expect(200)
      expect(listed.body.kind).toBe('plan')
      expect(validateInteractionPlan(listed.body.plan)).toEqual({ valid: true, errors: [] })
      expect(listed.body.plan.trace.tools.length).toBeGreaterThan(0)
      expect(listed.body.plan.needsConfirmation).toBe(false)
    })

    it('写路径：一句话 → plan（不执行）→ 确认令牌 → invoke → 一次性 → 审计可查', async () => {
      if (!available) return
      expect(readdirSync(exportDir)).toEqual([])
      expect(readdirSync(packagesDir)).toEqual([])

      const planned = await request(server())
        .post('/chat/message')
        .send({ message: `把模块 ${MODULE_ID} 导出为最小蓝图包` })
        .expect(200)
      expect(planned.body.kind).toBe('plan')
      expect(planned.body.plan.needsConfirmation).toBe(true)
      const confirm = confirmAction(planned.body.plan as InteractionPlan)
      expect(confirm.tool).toBe('erp_module_export')
      expect(confirm.args).toEqual(expect.objectContaining({ id: MODULE_ID }))
      expect(readdirSync(exportDir)).toEqual([])
      expect(readdirSync(packagesDir)).toEqual([])

      const args = confirm.args ?? {}
      const issued = await request(server())
        .post('/agent-tools/erp_module_export/confirm')
        .send({ args })
        .expect(200)
      expect(issued.body.token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
      const pending: Array<{ consumedAt: Date | null }> = await dataSource.query(
        `SELECT "consumedAt" FROM agent_confirmation_tokens WHERE id = $1`,
        [issued.body.token],
      )
      expect(pending).toHaveLength(1)
      expect(pending[0].consumedAt).toBeNull()

      const first = await request(server())
        .post('/agent-tools/erp_module_export/invoke')
        .send({ args, confirmationToken: issued.body.token })
        .expect(200)
      expect(first.body.ok).toBe(true)
      expect(first.body.tool).toBe('erp_module_export')
      expect(readdirSync(exportDir).length + readdirSync(packagesDir).length).toBeGreaterThan(0)

      const consumed: Array<{ consumedAt: Date | null }> = await dataSource.query(
        `SELECT "consumedAt" FROM agent_confirmation_tokens WHERE id = $1`,
        [issued.body.token],
      )
      expect(consumed[0].consumedAt).not.toBeNull()

      const replay = await request(server())
        .post('/agent-tools/erp_module_export/invoke')
        .send({ args, confirmationToken: issued.body.token })
        .expect(403)
      expect(httpMessage(replay.body)).toMatch(/已用|已失效|无效/)

      const rows = await toolAudits()
      const successes = rows.filter((row) => row.status === 'success')
      expect(successes).toHaveLength(1)
      expect(successes[0].metadata.tool).toBe('erp_module_export')
      expect(typeof successes[0].metadata.argsDigest).toBe('string')
      expect(successes[0].metadata.argsDigest).toHaveLength(64)
    })
  })

  describe('越权 / 未声明能力 → 明确拒绝且留痕', () => {
    it('未声明能力：「把订单删了」→ refusal，不调工具、不写审计', async () => {
      if (!available) return
      const before = await toolAudits()
      const refused = await request(server())
        .post('/chat/message')
        .send({ message: '把订单删了' })
        .expect(200)
      expect(refused.body.kind).toBe('refusal')
      expect(refused.body.message).toMatch(/没有这个能力/)
      expect(refused.body).not.toHaveProperty('plan')
      expect(await toolAudits()).toHaveLength(before.length)
    })

    it('越权：缺 tool:module:export → confirm 后 invoke 403，不写成功审计', async () => {
      if (!available) return
      currentUser.permissions = ['tool:module:read']
      const args = { id: MODULE_ID }
      const issued = await request(server())
        .post('/agent-tools/erp_module_export/confirm')
        .send({ args })
        .expect(200)

      const denied = await request(server())
        .post('/agent-tools/erp_module_export/invoke')
        .send({ args, confirmationToken: issued.body.token })
        .expect(403)
      expect(httpMessage(denied.body)).toContain('tool:module:export')

      const successes = (await toolAudits()).filter((row) => row.status === 'success')
      expect(successes).toHaveLength(0)
    })

    it('写工具无令牌 → 403，且临时目录仍为空', async () => {
      if (!available) return
      const isolated = mkdtempSync(join(tmpdir(), 'speckit-e2e-c5-notoken-'))
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
  })
})
