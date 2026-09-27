/**
 * 角色 → JWT 有效权限（真 Postgres）。
 *
 * 骨架照抄 `user-serialization.e2e-spec.ts`：60s 超时、最小 TestingModule、
 * TypeOrmModule.forRoot({ synchronize:false })、无库 skip 并给理由。
 * 既有用例走 AuthService.login；本轮补真实 HTTP：POST /auth/login
 * 与 POST /auth/switch-organization。
 */
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ConfigModule } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { join } from 'node:path'
import * as bcrypt from 'bcrypt'
import request from 'supertest'
import { AuthModule } from '../src/auth/auth.module'
import { AuthService } from '../src/auth/auth.service'
import { RolesModule } from '../src/roles/roles.module'
import { CacheModule } from '../src/cache/cache.module'
import { EventBusModule } from '../src/common/events/event-bus.module'
import type { User } from '../src/users/user.entity'

const ORG_A = '31313131-3131-4313-8313-313131313131'
const ORG_B = '32323232-3232-4323-8323-323232323232'
const USER_ID = '33333333-3333-4333-8333-333333333333'
const ROLE_A = '34343434-3434-4343-8343-343434343434'
const ROLE_B = '35353535-3535-4353-8353-353535353535'
const EMAIL = 'role-perm-e2e@test.local'
const PASSWORD = 'password12'
const ROLE_NAME = 'warehouse-clerk'
const ROLE_PERMS = ['inv:read', 'inv:adjust']
const OTHER_ORG_PERMS = ['other-org:secret', 'other-org:admin']
const DIRECT = ['direct:keep']
const MEMBER_A = '36363636-3636-4363-8363-363636363636'
const MEMBER_B = '37373737-3737-4373-8373-373737373737'

function decodeJwt(token: string): { permissions: string[]; role: string; organizationId?: string } {
  const payload = token.split('.')[1]
  return JSON.parse(Buffer.from(payload, 'base64url').toString())
}

describe('角色 → JWT 有效权限', () => {
  jest.setTimeout(60000)

  let app: INestApplication
  let dataSource: DataSource
  let authService: AuthService
  let available = true

  const actor = {
    id: USER_ID,
    name: EMAIL,
    email: EMAIL,
    role: ROLE_NAME,
    permissions: DIRECT,
  } as User

  beforeAll(async () => {
    process.env.CACHE_DRIVER = 'memory'
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        EventBusModule,
        CacheModule,
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
        AuthModule,
        RolesModule,
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    await app.init()
    dataSource = moduleRef.get(DataSource)
    authService = moduleRef.get(AuthService)

    try {
      await dataSource.query('SELECT 1 FROM organizations LIMIT 1')
      await dataSource.query('SELECT 1 FROM roles LIMIT 1')
    } catch (error) {
      available = false
      console.warn(`跳过 e2e：本地库不可用（${(error as Error).message}）`)
      return
    }

    await cleanup()
    await dataSource.query(
      `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
       VALUES ($1, 'e2e-role-perm-a', 'e2e-role-perm-a', 'active', now(), now()),
              ($2, 'e2e-role-perm-b', 'e2e-role-perm-b', 'active', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [ORG_A, ORG_B],
    )
    const passwordHash = await bcrypt.hash(PASSWORD, 10)
    await dataSource.query(
      `INSERT INTO users (id, name, email, role, status, permissions, "passwordHash", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'active', $5, $6, now(), now())
       ON CONFLICT (id) DO UPDATE SET
         role = EXCLUDED.role,
         permissions = EXCLUDED.permissions,
         "passwordHash" = EXCLUDED."passwordHash"`,
      [USER_ID, EMAIL, EMAIL, ROLE_NAME, DIRECT.join(','), passwordHash],
    )
    await dataSource.query(
      `INSERT INTO organization_members (id, "organizationId", "userId", role, "joinedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'member', now(), now(), now()),
              ($4, $5, $3, 'member', now(), now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [MEMBER_A, ORG_A, USER_ID, MEMBER_B, ORG_B],
    )
    await dataSource.query(
      `INSERT INTO roles (id, name, description, permissions, status, "organizationId", "createdAt", "updatedAt")
       VALUES ($1, $2, 'e2e selected org', $3, 'active', $4, now(), now()),
              ($5, $2, 'e2e other org', $6, 'active', $7, now(), now())
       ON CONFLICT (id) DO UPDATE SET permissions = EXCLUDED.permissions, status = EXCLUDED.status`,
      [ROLE_A, ROLE_NAME, ROLE_PERMS.join(','), ORG_A, ROLE_B, OTHER_ORG_PERMS.join(','), ORG_B],
    )
  }, 60000)

  afterAll(async () => {
    if (dataSource?.isInitialized && available) {
      await cleanup()
    }
    await app?.close()
  })

  async function cleanup(): Promise<void> {
    await dataSource.query(`DELETE FROM roles WHERE id = ANY($1::uuid[])`, [[ROLE_A, ROLE_B]]).catch(
      () => undefined,
    )
    await dataSource
      .query(`DELETE FROM organization_members WHERE "userId" = $1`, [USER_ID])
      .catch(() => undefined)
    await dataSource.query(`DELETE FROM users WHERE id = $1`, [USER_ID]).catch(() => undefined)
    await dataSource
      .query(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [[ORG_A, ORG_B]])
      .catch(() => undefined)
  }

  it('选中组织内的 active 角色权限进入 JWT', async () => {
    if (!available) return
    const result = await authService.login(actor, ORG_A)
    const payload = await authService.validateToken(result.access_token)
    expect(payload).not.toBeNull()
    expect(payload!.permissions).toEqual(expect.arrayContaining(ROLE_PERMS))
    expect(payload!.permissions).toEqual(expect.arrayContaining(DIRECT))
    expect(result.user.permissions).toEqual(payload!.permissions)
    expect(payload!.role).toBe(ROLE_NAME)
  })

  it('另一个组织的同名角色权限不进入 JWT', async () => {
    if (!available) return
    const result = await authService.login(actor, ORG_A)
    const payload = await authService.validateToken(result.access_token)
    expect(payload).not.toBeNull()
    for (const perm of OTHER_ORG_PERMS) {
      expect(payload!.permissions).not.toContain(perm)
    }
  })

  it('停用角色的权限不进入 JWT，登录仍成功且直授保留', async () => {
    if (!available) return
    await dataSource.query(`UPDATE roles SET status = 'inactive' WHERE id = $1`, [ROLE_A])
    const result = await authService.login(actor, ORG_A)
    const payload = await authService.validateToken(result.access_token)
    expect(result.access_token).toEqual(expect.any(String))
    expect(payload).not.toBeNull()
    for (const perm of ROLE_PERMS) {
      expect(payload!.permissions).not.toContain(perm)
    }
    expect(payload!.permissions).toEqual(DIRECT)
    await dataSource.query(`UPDATE roles SET status = 'active' WHERE id = $1`, [ROLE_A])
  })

  describe('HTTP POST /auth/login 与 /auth/switch-organization', () => {
    const server = () => app.getHttpServer()

    async function loginHttp(organizationId: string) {
      return request(server())
        .post('/auth/login')
        .send({ email: EMAIL, password: PASSWORD, organizationId })
    }

    it('POST /auth/login：选中组织内的 active 角色权限进入 token 与 user.permissions', async () => {
      if (!available) return
      await dataSource.query(`UPDATE roles SET status = 'active' WHERE id = $1`, [ROLE_A])
      const res = await loginHttp(ORG_A)
      expect(res.status).toBe(201)
      expect(res.body.access_token).toEqual(expect.any(String))
      const payload = decodeJwt(res.body.access_token)
      expect(payload.permissions).toEqual(expect.arrayContaining(ROLE_PERMS))
      expect(payload.permissions).toEqual(expect.arrayContaining(DIRECT))
      expect(res.body.user.permissions).toEqual(payload.permissions)
      expect(payload.role).toBe(ROLE_NAME)
    })

    it('POST /auth/login：另一个组织的同名角色权限不进入 token', async () => {
      if (!available) return
      await dataSource.query(`UPDATE roles SET status = 'active' WHERE id = $1`, [ROLE_A])
      const res = await loginHttp(ORG_A)
      expect(res.status).toBe(201)
      const payload = decodeJwt(res.body.access_token)
      for (const perm of OTHER_ORG_PERMS) {
        expect(payload.permissions).not.toContain(perm)
        expect(res.body.user.permissions).not.toContain(perm)
      }
    })

    it('POST /auth/login：停用角色的权限不进入 token，登录仍成功且直授保留', async () => {
      if (!available) return
      await dataSource.query(`UPDATE roles SET status = 'inactive' WHERE id = $1`, [ROLE_A])
      const res = await loginHttp(ORG_A)
      expect(res.status).toBe(201)
      expect(res.body.access_token).toEqual(expect.any(String))
      const payload = decodeJwt(res.body.access_token)
      for (const perm of ROLE_PERMS) {
        expect(payload.permissions).not.toContain(perm)
      }
      expect(payload.permissions).toEqual(DIRECT)
      expect(res.body.user.permissions).toEqual(DIRECT)
      await dataSource.query(`UPDATE roles SET status = 'active' WHERE id = $1`, [ROLE_A])
    })

    it('POST /auth/switch-organization：切到另一组织后权限按新组织解析', async () => {
      if (!available) return
      await dataSource.query(`UPDATE roles SET status = 'active' WHERE id = ANY($1::uuid[])`, [
        [ROLE_A, ROLE_B],
      ])
      const login = await loginHttp(ORG_A)
      expect(login.status).toBe(201)
      const before = decodeJwt(login.body.access_token)
      expect(before.permissions).toEqual(expect.arrayContaining(ROLE_PERMS))
      expect(before.organizationId).toBe(ORG_A)

      const switched = await request(server())
        .post('/auth/switch-organization')
        .set('Authorization', `Bearer ${login.body.access_token}`)
        .send({ organizationId: ORG_B })
      expect(switched.status).toBe(201)
      expect(switched.body.access_token).toEqual(expect.any(String))
      const after = decodeJwt(switched.body.access_token)
      expect(after.organizationId).toBe(ORG_B)
      expect(after.permissions).toEqual(expect.arrayContaining(OTHER_ORG_PERMS))
      expect(after.permissions).toEqual(expect.arrayContaining(DIRECT))
      for (const perm of ROLE_PERMS) {
        expect(after.permissions).not.toContain(perm)
      }
      expect(after.role).toBe(ROLE_NAME)
    })
  })
})
