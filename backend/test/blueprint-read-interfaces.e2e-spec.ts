/**
 * W2 蓝图只读接口 + 前端三条主路径（接口级，不是浏览器 e2e）。
 *
 * 覆盖：GET /semantic、单条记录读、租户隔离负例；
 * 以及页面实际调用的列表 / 迁移（含 409 与非法负例）/ 历史。
 */
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import request from 'supertest'
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { AtomicRegistryModule } from '../src/atomic-registry/atomic-registry.module'
import { AtomicRuntimeModule } from '../src/atomic-runtime/atomic-runtime.module'
import { BlueprintModule } from '../src/blueprint/blueprint.module'
import { SemanticRuntimeModule } from '../src/semantic-runtime/semantic-runtime.module'
import { BLUEPRINT_APPROVALS_DDL } from '../src/semantic-runtime/blueprint-approval.ddl'
import { BLUEPRINT_DOC_COUNTERS_DDL } from '../src/semantic-runtime/blueprint-doc-counter.ddl'
import { OUTBOX_DDL } from '../src/outbox/outbox.ddl'
import { NOTIFICATIONS_DDL } from '../src/notifications/notification.ddl'
import { BLUEPRINT_JOURNAL_ENTRIES_DDL } from '../src/semantic-runtime/blueprint-journal-entry.ddl'
import { BLUEPRINT_RECORDS_DDL } from '../src/semantic-runtime/blueprint-record.ddl'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'

const ORGANIZATION_ID = '26262626-2626-2626-2626-262626262626'
const OTHER_ORG = '27272727-2727-2727-2727-272727272727'
const UNAUTH_ORG = '28282828-2828-2828-2828-282828282828'
const PACKAGE_ID = 'auto-parts-1.1.0'
const TEMPLATES_DIR = resolve(__dirname, '../../templates')

function generatePemPair(): { publicPem: string; privatePem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }
}

describe('蓝图只读接口 + 前端主路径（W2 e2e）', () => {
  jest.setTimeout(60000)

  let app: INestApplication
  let dataSource: DataSource
  let available = true
  let packagesDir: string
  let keys: { publicPem: string; privatePem: string }
  let savedPublicKeys: string | undefined
  let savedPrivateKey: string | undefined
  let savedUnsigned: string | undefined
  let savedTemplates: string | undefined
  let customerId = ''
  let partId = ''

  const currentUser: {
    id: string
    userId: string
    organizationId: string
    permissions: string[]
  } = {
    id: 'e2e-w2-user',
    userId: 'e2e-w2-user',
    organizationId: ORGANIZATION_ID,
    permissions: ['inventory.cost.write'],
  }

  const server = () => app.getHttpServer()

  beforeAll(async () => {
    packagesDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-w2-pkgs-'))
    process.env.BLUEPRINT_PACKAGES_DIR = packagesDir
    savedTemplates = process.env.BLUEPRINT_TEMPLATES_DIR
    process.env.BLUEPRINT_TEMPLATES_DIR = TEMPLATES_DIR
    savedUnsigned = process.env.BLUEPRINT_ALLOW_UNSIGNED
    delete process.env.BLUEPRINT_ALLOW_UNSIGNED

    keys = generatePemPair()
    savedPublicKeys = process.env.BLUEPRINT_LICENSE_PUBLIC_KEYS
    savedPrivateKey = process.env.BLUEPRINT_LICENSE_PRIVATE_KEY
    process.env.BLUEPRINT_LICENSE_PUBLIC_KEYS = JSON.stringify([keys.publicPem])
    process.env.BLUEPRINT_LICENSE_PRIVATE_KEY = keys.privatePem

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
        AtomicRegistryModule,
        AtomicRuntimeModule,
        BlueprintModule,
        SemanticRuntimeModule,
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
      for (const statement of BLUEPRINT_RECORDS_DDL) {
        await dataSource.query(statement)
      }
      for (const statement of BLUEPRINT_DOC_COUNTERS_DDL) {
        await dataSource.query(statement)
      }
      for (const statement of BLUEPRINT_APPROVALS_DDL) {
        await dataSource.query(statement)
      }
      for (const statement of BLUEPRINT_JOURNAL_ENTRIES_DDL) {
        await dataSource.query(statement)
      }
      for (const statement of OUTBOX_DDL) {
        await dataSource.query(statement)
      }
      for (const statement of NOTIFICATIONS_DDL) {
        await dataSource.query(statement)
      }
    } catch (error) {
      available = false
      console.warn(`跳过 e2e：本地库不可用（${(error as Error).message}）`)
      return
    }

    await dataSource.query(
      `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
       VALUES ($1, 'e2e-w2', 'e2e-w2', 'active', now(), now()),
              ($2, 'e2e-w2-other', 'e2e-w2-other', 'active', now(), now()),
              ($3, 'e2e-w2-unauth', 'e2e-w2-unauth', 'active', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [ORGANIZATION_ID, OTHER_ORG, UNAUTH_ORG],
    )

    const delivered = await request(server()).post('/blueprints/auto-parts/deliver').send({
      grantedTo: [ORGANIZATION_ID, OTHER_ORG],
      resell: false,
      expiresAt: '2027-09-25T00:00:00Z',
      issuer: 'sapbase-platform',
    })
    if (delivered.status !== 200) {
      available = false
      console.warn(`跳过 e2e：deliver 失败（${delivered.status} ${JSON.stringify(delivered.body)}）`)
      return
    }
    await request(server()).post(`/blueprints/${PACKAGE_ID}/load`).expect(200)

    const part = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/Part`)
      .send({ partNo: 'P-W2-1', name: 'W2垫片', unitCost: 12.5, packSize: 12 })
      .expect(201)
    const customer = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/Customer`)
      .send({ name: 'W2客户', creditLimit: 80000 })
      .expect(201)
    partId = part.body.id
    customerId = customer.body.id
  }, 60000)

  afterAll(async () => {
    if (dataSource?.isInitialized && available) {
      await dataSource.query(`DELETE FROM blueprint_records WHERE "organizationId" IN ($1, $2, $3)`, [
        ORGANIZATION_ID,
        OTHER_ORG,
        UNAUTH_ORG,
      ])
      await dataSource.query(`DELETE FROM blueprint_approvals WHERE "organizationId" IN ($1, $2, $3)`, [
        ORGANIZATION_ID,
        OTHER_ORG,
        UNAUTH_ORG,
      ]).catch(() => undefined)
      await dataSource.query(
        `DELETE FROM blueprint_journal_entries WHERE "organizationId" IN ($1, $2, $3)`,
        [ORGANIZATION_ID, OTHER_ORG, UNAUTH_ORG],
      ).catch(() => undefined)
      await dataSource.query(
        `DELETE FROM blueprint_doc_counters WHERE "organizationId" IN ($1, $2, $3)`,
        [ORGANIZATION_ID, OTHER_ORG, UNAUTH_ORG],
      )
      await dataSource.query('DELETE FROM audit_logs WHERE "organizationId" IN ($1, $2, $3)', [
        ORGANIZATION_ID,
        OTHER_ORG,
        UNAUTH_ORG,
      ])
      await dataSource
        .query(
          `DELETE FROM outbox_deliveries WHERE "eventId" IN (SELECT id FROM outbox_events WHERE "organizationId" IN ($1, $2, $3))`,
          [ORGANIZATION_ID, OTHER_ORG, UNAUTH_ORG],
        )
        .catch(() => undefined)
      await dataSource
        .query(`DELETE FROM outbox_events WHERE "organizationId" IN ($1, $2, $3)`, [
          ORGANIZATION_ID,
          OTHER_ORG,
          UNAUTH_ORG,
        ])
        .catch(() => undefined)
      await dataSource.query('DELETE FROM organizations WHERE id IN ($1, $2, $3)', [
        ORGANIZATION_ID,
        OTHER_ORG,
        UNAUTH_ORG,
      ])
    }
    await app?.close()
    delete process.env.BLUEPRINT_PACKAGES_DIR
    if (savedTemplates === undefined) delete process.env.BLUEPRINT_TEMPLATES_DIR
    else process.env.BLUEPRINT_TEMPLATES_DIR = savedTemplates
    if (savedPublicKeys === undefined) delete process.env.BLUEPRINT_LICENSE_PUBLIC_KEYS
    else process.env.BLUEPRINT_LICENSE_PUBLIC_KEYS = savedPublicKeys
    if (savedPrivateKey === undefined) delete process.env.BLUEPRINT_LICENSE_PRIVATE_KEY
    else process.env.BLUEPRINT_LICENSE_PRIVATE_KEY = savedPrivateKey
    if (savedUnsigned === undefined) delete process.env.BLUEPRINT_ALLOW_UNSIGNED
    else process.env.BLUEPRINT_ALLOW_UNSIGNED = savedUnsigned
    if (packagesDir) rmSync(packagesDir, { recursive: true, force: true })
  })

  function line(quantity: number, unitPrice: number | string = 20) {
    return { quantity, unitPrice, part: partId }
  }

  it('GET /semantic：实体带 states/transitions/children，不含字段', async () => {
    if (!available) return
    const res = await request(server()).get(`/blueprints/${PACKAGE_ID}/semantic`).expect(200)
    expect(Array.isArray(res.body.entities)).toBe(true)
    const sales = res.body.entities.find((item: { name: string }) => item.name === 'SalesOrder')
    expect(sales).toMatchObject({
      name: 'SalesOrder',
      children: ['SalesOrderLine'],
      states: [
        { name: 'draft', initial: true, final: false },
        { name: 'confirmed', initial: false, final: false },
        { name: 'shipped', initial: false, final: false },
        { name: 'closed', initial: false, final: true },
      ],
      transitions: [
        { from: 'draft', to: 'confirmed' },
        { from: 'confirmed', to: 'shipped' },
        { from: 'shipped', to: 'closed' },
      ],
    })
    expect(sales.fields).toBeUndefined()
    expect(JSON.stringify(res.body)).not.toContain('"partNo"')
  })

  it('GET /semantic：未授权租户拒', async () => {
    if (!available) return
    currentUser.organizationId = UNAUTH_ORG
    const res = await request(server()).get(`/blueprints/${PACKAGE_ID}/semantic`)
    expect(res.status).toBeGreaterThanOrEqual(400)
    currentUser.organizationId = ORGANIZATION_ID
  })

  it('单条记录读：命中带 state/omittedFields；找不到与他租 → 404', async () => {
    if (!available) return
    const created = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder`)
      .send({ customer: customerId, quantity: 1, children: { SalesOrderLine: [line(1)] } })
      .expect(201)

    const hit = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}`)
      .expect(200)
    expect(hit.body.id).toBe(created.body.id)
    expect(hit.body.entity).toBe('SalesOrder')
    expect(hit.body.state).toBe('draft')
    expect(hit.body.version).toBe(created.body.version)
    expect(Array.isArray(hit.body.omittedFields)).toBe(true)

    await request(server())
      .get(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${randomUUID()}`)
      .expect(404)

    currentUser.organizationId = OTHER_ORG
    await request(server())
      .get(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}`)
      .expect(404)
    currentUser.organizationId = ORGANIZATION_ID
  })

  it('主路径① 列表：按包+实体+状态分页信封', async () => {
    if (!available) return
    const shipped = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder`)
      .send({ customer: customerId, quantity: 1, children: { SalesOrderLine: [line(1)] } })
      .expect(201)
    const draft = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder`)
      .send({ customer: customerId, quantity: 1, children: { SalesOrderLine: [line(1)] } })
      .expect(201)
    await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${shipped.body.id}/transition`)
      .send({ to: 'confirmed' })
      .expect(200)
    await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${shipped.body.id}/transition`)
      .send({ to: 'shipped' })
      .expect(200)

    const listed = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/records/SalesOrder`)
      .query({ state: 'shipped', page: 1, pageSize: 20 })
      .expect(200)
    expect(listed.body).toMatchObject({ page: 1, pageSize: 20 })
    expect(typeof listed.body.total).toBe('number')
    const ids = listed.body.items.map((row: { id: string }) => row.id)
    expect(ids).toContain(shipped.body.id)
    expect(ids).not.toContain(draft.body.id)
  })

  it('主路径② 迁移：合法推进；非法 400；版本冲突 409', async () => {
    if (!available) return
    const created = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder`)
      .send({ customer: customerId, quantity: 1, children: { SalesOrderLine: [line(1)] } })
      .expect(201)

    const illegal = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}/transition`)
      .send({ to: 'shipped' })
      .expect(400)
    expect(illegal.body.reason).toBe('invalid-transition')

    const conflict = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}/transition`)
      .send({ to: 'confirmed', expectedVersion: created.body.version + 99 })
      .expect(409)
    expect(conflict.body.reason).toBe('version-conflict')

    const ok = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}/transition`)
      .send({ to: 'confirmed', expectedVersion: created.body.version })
      .expect(200)
    expect(ok.body.state).toBe('confirmed')
  })

  it('主路径③ 历史：迁移后能读到 (from,to) 序列', async () => {
    if (!available) return
    const created = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder`)
      .send({ customer: customerId, quantity: 1, children: { SalesOrderLine: [line(1)] } })
      .expect(201)
    await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}/transition`)
      .send({ to: 'confirmed' })
      .expect(200)
    await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}/transition`)
      .send({ to: 'shipped' })
      .expect(200)

    const history = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}/history`)
      .expect(200)
    expect(history.body.map((item: { from: string; to: string }) => ({ from: item.from, to: item.to }))).toEqual([
      { from: 'draft', to: 'confirmed' },
      { from: 'confirmed', to: 'shipped' },
    ])
    expect(history.body.every((item: { at: string; actor: string }) => item.at && item.actor)).toBe(true)
  })
})
