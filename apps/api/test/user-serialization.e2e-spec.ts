/**
 * 用户凭据暴露面：直属 /users* 与嵌套 User 关系的响应都不得带出口令摘要。
 *
 * 骨架照抄 `agent-tools.e2e-spec.ts`：60s 超时、最小 TestingModule、
 * JwtAuthGuard 注入可改的 currentUser、无库 skip 并给理由、beforeAll 幂等应用 DDL。
 */
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import request from 'supertest'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import * as bcrypt from 'bcrypt'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'
import { ModuleRegistryModule } from '../src/module-registry/module-registry.module'
import { UsersModule } from '../src/users/users.module'
import { UsersService } from '../src/users/users.service'

const ORGANIZATION_ID = '27272727-2727-4272-8272-272727272727'
const MODULE_ID = '28282828-2828-4282-8282-282828282828'
const NESTED_USER_ID = '29292929-2929-4292-8292-292929292929'
const EMAIL_PREFIX = 'cred-exp-'
const CREATE_PASSWORD = 'password12'

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys)
    return keys
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      keys.add(key)
      collectKeys(nested, keys)
    }
  }
  return keys
}

function assertNoCredentialMaterial(body: unknown): void {
  expect(collectKeys(body).has('passwordHash')).toBe(false)
  const text = JSON.stringify(body)
  expect(text).not.toMatch(/\$2a\$/)
  expect(text).not.toMatch(/\$2b\$/)
}

describe('用户凭据暴露面（直属 + 嵌套）', () => {
  jest.setTimeout(60000)

  let app: INestApplication
  let dataSource: DataSource
  let available = true

  const currentUser: {
    id: string
    userId: string
    email: string
    role: string
    organizationId: string
    permissions: string[]
  } = {
    id: 'e2e-cred-exp-user',
    userId: 'e2e-cred-exp-user',
    email: 'cred-exp-actor@test.local',
    role: 'Admin',
    organizationId: ORGANIZATION_ID,
    permissions: ['system:manage'],
  }

  const server = () => app.getHttpServer()

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
        UsersModule,
        ModuleRegistryModule,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => Record<string, unknown> }
        }) => {
          const req = context.switchToHttp().getRequest()
          req.user = { ...currentUser }
          req.organizationId = currentUser.organizationId
          return true
        },
      })
      .compile()

    app = moduleRef.createNestApplication()
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
    } catch (error) {
      available = false
      console.warn(`跳过 e2e：本地库不可用（${(error as Error).message}）`)
      return
    }

    await dataSource.query(
      `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
       VALUES ($1, 'e2e-cred-exp', 'e2e-cred-exp', 'active', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [ORGANIZATION_ID],
    )
    await dataSource.query(`DELETE FROM module_registry WHERE "organizationId" = $1`, [
      ORGANIZATION_ID,
    ]).catch(() => undefined)
    await dataSource.query(`DELETE FROM users WHERE email LIKE $1 OR id = $2`, [
      `${EMAIL_PREFIX}%`,
      NESTED_USER_ID,
    ]).catch(() => undefined)

    const nestedHash = await bcrypt.hash('nested-secret-99', 10)
    await dataSource.query(
      `INSERT INTO users
        (id, name, email, "passwordHash", role, status, permissions, "createdAt", "updatedAt")
       VALUES ($1, 'Nested Owner', $2, $3, 'user', 'active', '', now(), now())`,
      [NESTED_USER_ID, `${EMAIL_PREFIX}nested@test.local`, nestedHash],
    )
    await dataSource.query(
      `INSERT INTO module_registry
        (id, "createdAt", "updatedAt", "organizationId", name, version, status, "moduleType",
         "dependsOnAtomics", metadata, "createdById")
       VALUES
        ($1, now(), now(), $2, 'e2e-cred-exp-module', '1.0.0', 'active', 'crud',
         '[]'::jsonb, $3::jsonb, $4)`,
      [MODULE_ID, ORGANIZATION_ID, JSON.stringify({ entities: ['Probe'] }), NESTED_USER_ID],
    )
  })

  afterAll(async () => {
    if (dataSource?.isInitialized && available) {
      await dataSource.query(`DELETE FROM module_registry WHERE "organizationId" = $1`, [
        ORGANIZATION_ID,
      ]).catch(() => undefined)
      await dataSource.query(`DELETE FROM users WHERE email LIKE $1 OR id = $2`, [
        `${EMAIL_PREFIX}%`,
        NESTED_USER_ID,
      ]).catch(() => undefined)
    }
    if (app) await app.close()
  })

  afterEach(() => {
    currentUser.id = 'e2e-cred-exp-user'
    currentUser.userId = 'e2e-cred-exp-user'
    currentUser.email = 'cred-exp-actor@test.local'
    currentUser.role = 'Admin'
    currentUser.organizationId = ORGANIZATION_ID
    currentUser.permissions = ['system:manage']
  })

  it('直属 POST/GET/PUT /users* 响应不含 passwordHash 或 bcrypt 形态', async () => {
    if (!available) return
    const email = `${EMAIL_PREFIX}${randomUUID()}@test.local`

    const created = await request(server())
      .post('/users')
      .send({
        name: 'Cred Exp Target',
        email,
        password: CREATE_PASSWORD,
      })
      .expect(201)
    assertNoCredentialMaterial(created.body)
    const userId = created.body.data.id as string
    expect(userId).toBeTruthy()

    const one = await request(server()).get(`/users/${userId}`).expect(200)
    assertNoCredentialMaterial(one.body)

    const updated = await request(server())
      .put(`/users/${userId}`)
      .send({ name: 'Cred Exp Updated' })
      .expect(200)
    assertNoCredentialMaterial(updated.body)

    const listed = await request(server()).get('/users').expect(200)
    assertNoCredentialMaterial(listed.body)
    expect(Array.isArray(listed.body.data)).toBe(true)
  })

  it('嵌套 createdBy：GET /module-registry 也不含 passwordHash 或 bcrypt 形态', async () => {
    if (!available) return
    const listed = await request(server()).get('/module-registry').expect(200)
    assertNoCredentialMaterial(listed.body)
    const match = (listed.body as Array<{ id: string; createdBy?: { id: string; email?: string } }>).find(
      (row) => row.id === MODULE_ID,
    )
    expect(match).toBeDefined()
    expect(match?.createdBy?.id).toBe(NESTED_USER_ID)
    expect(match?.createdBy?.email).toBe(`${EMAIL_PREFIX}nested@test.local`)
  })

  it('凭据读取路径仍能取到摘要并比对成功', async () => {
    if (!available) return
    const email = `${EMAIL_PREFIX}${randomUUID()}@test.local`
    await request(server())
      .post('/users')
      .send({
        name: 'Cred Exp Login',
        email,
        password: CREATE_PASSWORD,
      })
      .expect(201)

    const usersService = app.get(UsersService)
    const loaded = await usersService.findByEmail(email)
    expect(loaded?.passwordHash).toMatch(/^\$2[ab]\$/)
    expect(await bcrypt.compare(CREATE_PASSWORD, loaded!.passwordHash)).toBe(true)
  })
})
