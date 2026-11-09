import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Client } from 'pg'
import request from 'supertest'
import { DataSource, Entity, PrimaryColumn } from 'typeorm'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'
import { DataScopeModule } from '../src/data-scope/data-scope.module'
import { DATA_SCOPE_DDL } from '../src/data-scope/data-scope.ddl'
import {
  DataPolicy,
  ScopeBinding,
  ScopeDimension,
  ScopeMembership,
  ScopeNode,
  ScopeVersion,
} from '../src/data-scope/entities'
import { AuditLog } from '../src/audit-logs/audit-log.entity'

const RUN = process.env.RUN_DATA_SCOPE_RLS === '1'
const describeDb = RUN ? describe : describe.skip

@Entity('organizations')
class Organization {
  @PrimaryColumn('uuid')
  id: string
}

/**
 * 数据范围管理 API 的 HTTP e2e（真实 Postgres）：
 *   - 权限点不足 → 403
 *   - 维度/节点/成员/绑定/策略 CRUD → 真实落库
 *   - 预览：有策略返回谓词，无策略返回 none（fail-closed）
 *   - 删除不存在维度 → 404
 *
 * 默认跳过；本地：
 *   RUN_DATA_SCOPE_RLS=1 npx jest --config test/jest-e2e.json test/data-scope-http.e2e-spec.ts --runInBand
 */
describeDb('data scope HTTP API (real Postgres)', () => {
  const suffix = `${Date.now()}_${process.pid}`
  const dbName = `sapbase_ds_http_${suffix}`
  const orgId = '66666666-6666-4666-8666-666666666666'

  let root: Client
  let app: INestApplication
  let dataSource: DataSource
  let currentUser: {
    id: string
    userId: string
    organizationId: string
    role: string
    permissions: string[]
  }

  beforeAll(async () => {
    root = new Client({ database: 'postgres' })
    await root.connect()
    await root.query(`CREATE DATABASE "${dbName}"`)

    const setup = new Client({ database: dbName })
    await setup.connect()
    try {
      await setup.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
      await setup.query('CREATE TABLE public.organizations (id uuid PRIMARY KEY)')
      await setup.query(`CREATE TABLE public.audit_logs (
        id uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "organizationId" uuid NOT NULL,
        action character varying NOT NULL,
        resource character varying NOT NULL,
        actor character varying NOT NULL,
        status character varying(50) NOT NULL,
        "resourceId" uuid,
        changes jsonb,
        metadata jsonb,
        timestamp timestamp DEFAULT now() NOT NULL
      )`)
      for (const statement of DATA_SCOPE_DDL) await setup.query(statement)
      await setup.query('INSERT INTO public.organizations (id) VALUES ($1)', [orgId])
    } finally {
      await setup.end()
    }

    currentUser = {
      id: 'http-user',
      userId: 'http-user',
      organizationId: orgId,
      role: 'manager',
      permissions: ['data-scope:read', 'data-scope:manage'],
    }

    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USERNAME || 'mac',
          password: process.env.DB_PASSWORD || '',
          database: dbName,
          entities: [
            Organization,
            AuditLog,
            ScopeDimension,
            ScopeNode,
            ScopeMembership,
            ScopeBinding,
            DataPolicy,
            ScopeVersion,
          ],
          synchronize: false,
        }),
        DataScopeModule,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => { user?: unknown; organizationId?: string }
          }
        }) => {
          const request = context.switchToHttp().getRequest()
          request.user = { ...currentUser }
          request.organizationId = currentUser.organizationId
          return true
        },
      })
      .compile()

    app = moduleRef.createNestApplication()
    await app.init()
    dataSource = moduleRef.get(DataSource)
  }, 30000)

  afterAll(async () => {
    await app?.close().catch(() => undefined)
    await dataSource?.destroy().catch(() => undefined)
    await root
      ?.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`)
      .catch(() => undefined)
    await root?.end().catch(() => undefined)
  }, 30000)

  const server = () => app.getHttpServer()

  let dimensionId = ''
  let nodeId = ''

  it('缺少 data-scope:manage → 403', async () => {
    currentUser = { ...currentUser, permissions: ['data-scope:read'] }
    const response = await request(server())
      .post('/data-scope/dimensions')
      .send({ key: 'region', name: 'Region' })
    expect(response.status).toBe(403)
    currentUser = { ...currentUser, permissions: ['data-scope:read', 'data-scope:manage'] }
  })

  it('创建维度/节点/成员/绑定/策略并落库', async () => {
    const dimension = await request(server())
      .post('/data-scope/dimensions')
      .send({ key: 'region', name: 'Region' })
    expect(dimension.status).toBe(201)
    dimensionId = dimension.body.id
    expect(dimension.body).toMatchObject({ key: 'region', organizationId: orgId })

    const node = await request(server())
      .post('/data-scope/nodes')
      .send({ dimensionId, name: 'Jiangsu' })
    expect(node.status).toBe(201)
    nodeId = node.body.id
    expect(node.body.path).toBe(`/${nodeId}`)

    const membership = await request(server())
      .post('/data-scope/memberships')
      .send({
        subjectType: 'user',
        subjectId: 'http-user',
        nodeId,
        positionKey: 'manager',
      })
    expect(membership.status).toBe(201)

    const binding = await request(server())
      .post('/data-scope/bindings')
      .send({
        resourceKey: 'platform:crm_customers',
        dimensionKey: 'region',
        kind: 'field',
        field: 'regionId',
      })
    expect(binding.status).toBe(201)

    const policy = await request(server())
      .post('/data-scope/policies')
      .send({
        name: 'manager subtree',
        subject: { kind: 'role', roleKey: 'manager' },
        resourceKey: 'platform:crm_customers',
        actions: ['read', 'list'],
        effect: 'allow',
        scope: {
          kind: 'node',
          dimension: 'region',
          anchor: 'membership',
          positions: ['manager'],
          depth: 'subtree',
        },
      })
    expect(policy.status).toBe(201)

    const list = await request(server()).get('/data-scope/dimensions')
    expect(list.status).toBe(200)
    expect(list.body.map((row: { key: string }) => row.key)).toContain('region')
  })

  it('预览返回谓词（不返回业务行）', async () => {
    const response = await request(server())
      .post('/data-scope/preview')
      .send({ resourceKey: 'platform:crm_customers', action: 'read' })
    expect(response.status).toBe(201)
    expect(response.body.declared).toBe(true)
    expect(response.body.expr).toMatchObject({
      op: 'in',
      field: { kind: 'column', column: 'regionId' },
      values: [{ kind: 'literal', value: nodeId }],
    })
    expect(JSON.stringify(response.body)).not.toContain('crm_customers row')
  })

  it('有绑定但无策略 → 预览 none（fail-closed）', async () => {
    await request(server())
      .post('/data-scope/bindings')
      .send({
        resourceKey: 'platform:orders',
        dimensionKey: 'region',
        kind: 'field',
        field: 'regionId',
      })
      .expect(201)
    const response = await request(server())
      .post('/data-scope/preview')
      .send({ resourceKey: 'platform:orders', action: 'read' })
    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({ expr: { op: 'none' }, declared: true })
  })

  it('删除不存在的维度 → 404', async () => {
    const response = await request(server()).delete(
      '/data-scope/dimensions/00000000-0000-4000-8000-000000000000',
    )
    expect(response.status).toBe(404)
  })
})
