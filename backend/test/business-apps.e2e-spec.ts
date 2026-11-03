import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import request from 'supertest'
import { join } from 'node:path'
import { BusinessAppsModule } from '../src/business-apps/business-apps.module'
import { BUSINESS_APP_INSTALLATIONS_DDL } from '../src/business-apps/business-app-installation.ddl'
import { BlueprintService } from '../src/blueprint/blueprint.service'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'
import { AgentToolsModule } from '../src/agent-tools/agent-tools.module'
import { AGENT_CONFIRMATION_TOKENS_DDL } from '../src/agent-tools/confirmation-token.ddl'

const ORG = '41414141-4141-4141-8141-414141414141'
const USER = '42424242-4242-4242-8242-424242424242'
const DIGEST = `sha256:${'c'.repeat(64)}`
const NEXT_DIGEST = `sha256:${'d'.repeat(64)}`

describe('Business Apps e2e', () => {
  jest.setTimeout(60000)

  let app: INestApplication
  let dataSource: DataSource
  let available = true

  const currentUser = {
    id: USER,
    userId: USER,
    email: 'business-app-e2e@test.local',
    organizationId: ORG,
    permissions: ['system:manage', 'tool:blueprint:read'],
  }

  const blueprints = {
    list: jest.fn(async () => []),
    load: jest.fn(async (packageId: string) => ({
      manifest: {
        blueprint: 'erp',
        version: packageId === 'erp-1.1.0' ? '1.1.0' : '1.0.0',
        runtime: '>=1.0.0 <2.0.0',
      },
      plan: { irDigest: packageId === 'erp-1.1.0' ? NEXT_DIGEST : DIGEST },
      license: { issuer: 'sapbase-platform' },
    })),
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
        BusinessAppsModule,
        AgentToolsModule,
      ],
    })
      .overrideProvider(BlueprintService)
      .useValue(blueprints)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              user?: Record<string, unknown>
              organizationId?: string
            }
          }
        }) => {
          const request = context.switchToHttp().getRequest()
          request.user = { ...currentUser }
          request.organizationId = ORG
          return true
        },
      })
      .compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
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
      for (const statement of BUSINESS_APP_INSTALLATIONS_DDL) {
        await dataSource.query(statement)
      }
      for (const statement of AGENT_CONFIRMATION_TOKENS_DDL) {
        await dataSource.query(statement)
      }
    } catch (error) {
      available = false
      console.warn(`跳过 e2e：本地库不可用（${(error as Error).message}）`)
      return
    }

    await cleanup()
    await dataSource.query(
      `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
       VALUES ($1, 'business-app-e2e', 'business-app-e2e', 'active', now(), now())`,
      [ORG],
    )
    await dataSource.query(
      `INSERT INTO users
        (id, name, email, status, permissions, "passwordHash", "createdAt", "updatedAt")
       VALUES ($1, 'business-app-e2e', $2, 'active', 'system:manage', 'x', now(), now())`,
      [USER, currentUser.email],
    )
  })

  afterAll(async () => {
    if (dataSource?.isInitialized && available) {
      await cleanup()
    }
    await app?.close()
  })

  async function cleanup(): Promise<void> {
    await dataSource
      .query(`DELETE FROM app_installations WHERE "organizationId" = $1`, [ORG])
      .catch(() => undefined)
    await dataSource
      .query(`DELETE FROM audit_logs WHERE "organizationId" = $1`, [ORG])
      .catch(() => undefined)
    await dataSource.query(`DELETE FROM users WHERE id = $1`, [USER]).catch(() => undefined)
    await dataSource.query(`DELETE FROM organizations WHERE id = $1`, [ORG]).catch(() => undefined)
  }

  it('安装 → 升级 → 回滚 → 应用上下文 → 暂停后拒绝 → 恢复', async () => {
    if (!available) return

    const installed = await request(app.getHttpServer())
      .post('/api/apps/install')
      .send({ packageId: 'erp-1.0.0', deploymentProfile: 'shared-saas' })
      .expect(201)

    expect(installed.body).toMatchObject({
      organizationId: ORG,
      appKey: 'erp',
      releaseDigest: DIGEST,
      status: 'active',
    })

    const duplicate = await request(app.getHttpServer())
      .post('/api/apps/install')
      .send({ packageId: 'erp-1.0.0' })
      .expect(201)
    expect(duplicate.body.id).toBe(installed.body.id)
    expect(
      await dataSource.query(
        `SELECT count(*)::int AS count FROM app_installations WHERE "organizationId" = $1`,
        [ORG],
      ),
    ).toEqual([{ count: 1 }])

    const installedRevisions = await request(app.getHttpServer())
      .get(`/api/apps/${installed.body.id}/revisions`)
      .expect(200)
    expect(installedRevisions.body).toHaveLength(1)
    expect(installedRevisions.body[0]).toMatchObject({
      action: 'installed',
      releaseDigest: DIGEST,
      packageId: 'erp-1.0.0',
    })

    const upgraded = await request(app.getHttpServer())
      .post(`/api/apps/${installed.body.id}/upgrade`)
      .send({ packageId: 'erp-1.1.0' })
      .expect(200)
    expect(upgraded.body).toMatchObject({
      blueprintVersion: '1.1.0',
      releaseDigest: NEXT_DIGEST,
    })

    const afterUpgrade = await request(app.getHttpServer())
      .get(`/api/apps/${installed.body.id}/revisions`)
      .expect(200)
    expect(afterUpgrade.body).toHaveLength(2)
    expect(afterUpgrade.body[1]).toMatchObject({
      action: 'upgraded',
      previousRevisionId: afterUpgrade.body[0].id,
      packageId: 'erp-1.1.0',
    })

    const rolledBack = await request(app.getHttpServer())
      .post(`/api/apps/${installed.body.id}/rollback`)
      .send({})
      .expect(200)
    expect(rolledBack.body).toMatchObject({
      blueprintVersion: '1.0.0',
      releaseDigest: DIGEST,
    })
    const afterRollback = await request(app.getHttpServer())
      .get(`/api/apps/${installed.body.id}/revisions`)
      .expect(200)
    expect(afterRollback.body).toHaveLength(3)
    expect(afterRollback.body[2]).toMatchObject({
      action: 'rollback',
      previousRevisionId: afterUpgrade.body[1].id,
      packageId: 'erp-1.0.0',
    })

    const context = await request(app.getHttpServer())
      .get(`/api/apps/${installed.body.id}/context`)
      .set('X-App-Id', installed.body.id)
      .expect(200)
    expect(context.body).toMatchObject({
      organizationId: ORG,
      appInstallationId: installed.body.id,
      appKey: 'erp',
      userId: USER,
      runtimeProfile: 'shared-saas',
    })

    await request(app.getHttpServer())
      .post('/api/agent-tools/erp_blueprint_list/invoke')
      .set('X-App-Id', installed.body.id)
      .send({ args: {} })
      .expect(200)
    const toolAudit = await dataSource.query(
      `SELECT metadata
         FROM audit_logs
        WHERE action = 'chat.tool.invoked' AND "organizationId" = $1
        ORDER BY "timestamp" DESC
        LIMIT 1`,
      [ORG],
    )
    expect(toolAudit[0].metadata).toMatchObject({
      appInstallationId: installed.body.id,
      appKey: 'erp',
      tool: 'erp_blueprint_list',
    })

    await request(app.getHttpServer())
      .post(`/api/apps/${installed.body.id}/suspend`)
      .expect(200)

    await request(app.getHttpServer())
      .get(`/api/apps/${installed.body.id}/context`)
      .set('X-App-Id', installed.body.id)
      .expect(404)

    await request(app.getHttpServer())
      .post(`/api/apps/${installed.body.id}/activate`)
      .expect(200)

    await request(app.getHttpServer())
      .get(`/api/apps/${installed.body.id}/context`)
      .set('X-App-Id', installed.body.id)
      .expect(200)
  })
})
