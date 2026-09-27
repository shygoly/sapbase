/**
 * N1 通知 + N2 待办：投递时产生通知、重启不丢、inbox 跨单据、批准同事务消失。
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
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'
import { BlueprintModule } from '../src/blueprint/blueprint.module'
import { NotificationsModule } from '../src/notifications/notifications.module'
import { NOTIFICATIONS_DDL } from '../src/notifications/notification.ddl'
import { OutboxDispatcherService } from '../src/outbox/outbox-dispatcher.service'
import { OUTBOX_DDL } from '../src/outbox/outbox.ddl'
import { BLUEPRINT_APPROVALS_DDL } from '../src/semantic-runtime/blueprint-approval.ddl'
import { BLUEPRINT_DOC_COUNTERS_DDL } from '../src/semantic-runtime/blueprint-doc-counter.ddl'
import { BLUEPRINT_JOURNAL_ENTRIES_DDL } from '../src/semantic-runtime/blueprint-journal-entry.ddl'
import { BLUEPRINT_RECORDS_DDL } from '../src/semantic-runtime/blueprint-record.ddl'
import { SemanticRuntimeModule } from '../src/semantic-runtime/semantic-runtime.module'
import { NotificationService } from '../src/websocket/services/notification.service'

const ORGANIZATION_ID = '19191919-1919-4919-8919-191919191919'
const OTHER_ORG = '20202020-2020-4020-8020-202020202020'
const MANAGER_ID = '21212121-2121-4121-8121-212121212121'
const CLERK_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_USER_ID = '23232323-2323-4233-8233-232323232323'
const PACKAGE_ID = 'auto-parts-1.1.0'
const TEMPLATES_DIR = resolve(__dirname, '../../templates')

function generatePemPair(): { publicPem: string; privatePem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }
}

describe('Notifications + Inbox（N1/N2 e2e）', () => {
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
  let salesOrderId = ''

  let currentUser: {
    id: string
    userId: string
    email: string
    role?: string
    organizationId?: string
    permissions: string[]
  } = {
    id: MANAGER_ID,
    userId: MANAGER_ID,
    email: 'n1-manager@test.local',
    role: 'sales-manager',
    organizationId: ORGANIZATION_ID,
    permissions: ['inventory.cost.write'],
  }

  const server = () => app.getHttpServer()

  beforeAll(async () => {
    packagesDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-n1n2-pkgs-'))
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
        NotificationsModule,
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
      for (const statement of BLUEPRINT_RECORDS_DDL) await dataSource.query(statement)
      for (const statement of BLUEPRINT_DOC_COUNTERS_DDL) await dataSource.query(statement)
      for (const statement of BLUEPRINT_APPROVALS_DDL) await dataSource.query(statement)
      for (const statement of BLUEPRINT_JOURNAL_ENTRIES_DDL) await dataSource.query(statement)
      for (const statement of OUTBOX_DDL) await dataSource.query(statement)
      for (const statement of NOTIFICATIONS_DDL) await dataSource.query(statement)
    } catch (error) {
      available = false
      console.warn(`跳过 e2e：本地库不可用（${(error as Error).message}）`)
      return
    }

    await dataSource.query(`DELETE FROM notifications WHERE "organizationId" = ANY($1::uuid[])`, [
      [ORGANIZATION_ID, OTHER_ORG],
    ]).catch(() => undefined)
    await dataSource.query(
      `DELETE FROM organization_members WHERE "userId" = ANY($1::uuid[])`,
      [[MANAGER_ID, CLERK_ID, OTHER_USER_ID]],
    ).catch(() => undefined)
    await dataSource.query(`DELETE FROM users WHERE email LIKE 'n1-%@test.local'`).catch(() => undefined)

    await dataSource.query(
      `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
       VALUES ($1, 'e2e-n1n2', 'e2e-n1n2', 'active', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [ORGANIZATION_ID],
    )
    await dataSource.query(
      `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
       VALUES ($1, 'e2e-n1n2-other', 'e2e-n1n2-other', 'active', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [OTHER_ORG],
    )
    await seedUser(MANAGER_ID, 'n1-manager@test.local', 'sales-manager', ORGANIZATION_ID)
    await seedUser(CLERK_ID, 'n1-clerk@test.local', 'clerk', ORGANIZATION_ID)
    await seedUser(OTHER_USER_ID, 'n1-other@test.local', 'sales-manager', OTHER_ORG)

    const delivered = await request(server()).post('/blueprints/auto-parts/deliver').send({
      grantedTo: [ORGANIZATION_ID],
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
      .send({ partNo: 'P-N1N2-1', name: '通知待办件', unitCost: 12.5, packSize: 12 })
      .expect(201)
    const customer = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/Customer`)
      .send({ name: '通知待办客户', creditLimit: 80000 })
      .expect(201)
    partId = part.body.id
    customerId = customer.body.id
  }, 60000)

  afterAll(async () => {
    if (dataSource?.isInitialized && available) {
      await dataSource
        .query(`DELETE FROM notifications WHERE "organizationId" = ANY($1::uuid[])`, [
          [ORGANIZATION_ID, OTHER_ORG],
        ])
        .catch(() => undefined)
      await dataSource
        .query(`DELETE FROM outbox_deliveries WHERE "eventId" IN (SELECT id FROM outbox_events WHERE "organizationId" = ANY($1::uuid[]))`, [
          [ORGANIZATION_ID, OTHER_ORG],
        ])
        .catch(() => undefined)
      await dataSource
        .query(`DELETE FROM outbox_events WHERE "organizationId" = ANY($1::uuid[])`, [
          [ORGANIZATION_ID, OTHER_ORG],
        ])
        .catch(() => undefined)
      await dataSource
        .query(`DELETE FROM blueprint_approvals WHERE "organizationId" = ANY($1::uuid[])`, [
          [ORGANIZATION_ID, OTHER_ORG],
        ])
        .catch(() => undefined)
      await dataSource
        .query(`DELETE FROM blueprint_journal_entries WHERE "organizationId" = $1`, [ORGANIZATION_ID])
        .catch(() => undefined)
      await dataSource
        .query(`DELETE FROM blueprint_records WHERE "organizationId" = $1`, [ORGANIZATION_ID])
        .catch(() => undefined)
      await dataSource
        .query(`DELETE FROM blueprint_doc_counters WHERE "organizationId" = $1`, [ORGANIZATION_ID])
        .catch(() => undefined)
      await dataSource.query('DELETE FROM audit_logs WHERE "organizationId" = ANY($1::uuid[])', [
        [ORGANIZATION_ID, OTHER_ORG],
      ])
      await dataSource.query('DELETE FROM organization_members WHERE "organizationId" = ANY($1::uuid[])', [
        [ORGANIZATION_ID, OTHER_ORG],
      ])
      await dataSource.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [
        [MANAGER_ID, CLERK_ID, OTHER_USER_ID],
      ])
      await dataSource.query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [
        [ORGANIZATION_ID, OTHER_ORG],
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

  async function seedUser(id: string, email: string, role: string, organizationId: string): Promise<void> {
    await dataSource.query(
      `INSERT INTO users (id, name, email, role, status, permissions, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'active', '', now(), now())
       ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, email = EXCLUDED.email`,
      [id, email, email, role],
    )
    await dataSource.query(
      `INSERT INTO organization_members (id, "organizationId", "userId", role, "joinedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'member', now(), now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [randomUUID(), organizationId, id],
    )
  }

  async function seedCrossEntityApprovals(): Promise<void> {
    await dataSource.query(
      `INSERT INTO blueprint_approvals (
         id, "createdAt", "updatedAt", "organizationId", "blueprintId", "blueprintVersion",
         entity, "recordId", "ruleId", "stepIndex", role, status
       ) VALUES
         ($1, now(), now(), $3, 'auto-parts', '1.1.0', 'Part', $4, 'inbox-seed-part', 0, 'sales-manager', 'pending'),
         ($2, now(), now(), $3, 'auto-parts', '1.1.0', 'Customer', $5, 'inbox-seed-customer', 0, 'sales-manager', 'pending')`,
      [randomUUID(), randomUUID(), ORGANIZATION_ID, randomUUID(), randomUUID()],
    )
  }

  it('审批待审：drain 前通知表没有，drain 后才有；新实例仍能读未读', async () => {
    if (!available) return
    currentUser = {
      id: MANAGER_ID,
      userId: MANAGER_ID,
      email: 'n1-manager@test.local',
      role: 'sales-manager',
      organizationId: ORGANIZATION_ID,
      permissions: ['inventory.cost.write'],
    }
    const created = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder`)
      .send({
        customer: customerId,
        quantity: 6000,
        children: {
          SalesOrderLine: [{ quantity: 6000, unitPrice: '20.0000', part: partId }],
        },
      })
      .expect(201)
    salesOrderId = created.body.id

    const before = await dataSource.query(
      `SELECT id FROM notifications WHERE "organizationId" = $1 AND "userId" = $2`,
      [ORGANIZATION_ID, MANAGER_ID],
    )
    expect(before).toHaveLength(0)

    await app.get(OutboxDispatcherService).drain()

    const after = await dataSource.query(
      `SELECT title, "sourceEventId" FROM notifications WHERE "organizationId" = $1 AND "userId" = $2 AND read = false`,
      [ORGANIZATION_ID, MANAGER_ID],
    )
    expect(after.length).toBeGreaterThanOrEqual(1)
    expect(after[0].title).toBe('有一张单等你批')

    const clerkRows = await dataSource.query(
      `SELECT id FROM notifications WHERE "organizationId" = $1 AND "userId" = $2`,
      [ORGANIZATION_ID, CLERK_ID],
    )
    expect(clerkRows).toHaveLength(0)

    const fresh = new NotificationService(dataSource)
    const unread = await fresh.listForUser(MANAGER_ID, ORGANIZATION_ID, false)
    expect(unread.some((item) => item.title === '有一张单等你批')).toBe(true)
  })

  it('GET /notifications 默认未读；已读持久；越权 404', async () => {
    if (!available) return
    currentUser = {
      id: MANAGER_ID,
      userId: MANAGER_ID,
      email: 'n1-manager@test.local',
      role: 'sales-manager',
      organizationId: ORGANIZATION_ID,
      permissions: ['inventory.cost.write'],
    }
    const listed = await request(server()).get('/notifications').expect(200)
    expect(listed.body.notifications.length).toBeGreaterThanOrEqual(1)
    const id = listed.body.notifications[0].id

    currentUser = {
      id: CLERK_ID,
      userId: CLERK_ID,
      email: 'n1-clerk@test.local',
      role: 'clerk',
      organizationId: ORGANIZATION_ID,
      permissions: [],
    }
    await request(server()).post(`/notifications/${id}/read`).expect(404)

    currentUser = {
      id: MANAGER_ID,
      userId: MANAGER_ID,
      email: 'n1-manager@test.local',
      role: 'sales-manager',
      organizationId: ORGANIZATION_ID,
      permissions: ['inventory.cost.write'],
    }
    await request(server()).post(`/notifications/${id}/read`).expect(201)
    const unread = await request(server()).get('/notifications').expect(200)
    expect(unread.body.notifications.find((item: { id: string }) => item.id === id)).toBeUndefined()
    const all = await request(server()).get('/notifications?all=true').expect(200)
    expect(all.body.notifications.find((item: { id: string; read: boolean }) => item.id === id)?.read).toBe(
      true,
    )
  })

  it('GET /inbox：三张不同单据待审 = 3；角色不符/已全批后条数不变；批准后 = 2', async () => {
    if (!available) return
    if (!salesOrderId) return
    await seedCrossEntityApprovals()

    currentUser = {
      id: MANAGER_ID,
      userId: MANAGER_ID,
      email: 'n1-manager@test.local',
      role: 'sales-manager',
      organizationId: ORGANIZATION_ID,
      permissions: ['inventory.cost.write'],
    }
    const first = await request(server()).get('/inbox').expect(200)
    expect(first.body).toHaveLength(3)
    const entities = first.body.map((item: { entity: string }) => item.entity).sort()
    expect(entities).toEqual(['Customer', 'Part', 'SalesOrder'])

    currentUser = {
      id: CLERK_ID,
      userId: CLERK_ID,
      email: 'n1-clerk@test.local',
      role: 'clerk',
      organizationId: ORGANIZATION_ID,
      permissions: [],
    }
    const clerkInbox = await request(server()).get('/inbox').expect(200)
    expect(clerkInbox.body).toEqual([])

    currentUser = {
      id: CLERK_ID,
      userId: CLERK_ID,
      email: 'n1-clerk@test.local',
      organizationId: ORGANIZATION_ID,
      permissions: [],
    }
    delete (currentUser as { role?: string }).role
    const noRole = await request(server()).get('/inbox').expect(200)
    expect(noRole.body).toEqual([])

    currentUser = {
      id: OTHER_USER_ID,
      userId: OTHER_USER_ID,
      email: 'n1-other@test.local',
      role: 'sales-manager',
      organizationId: OTHER_ORG,
      permissions: [],
    }
    const otherOrg = await request(server()).get('/inbox').expect(200)
    expect(otherOrg.body).toEqual([])

    currentUser = {
      id: MANAGER_ID,
      userId: MANAGER_ID,
      email: 'n1-manager@test.local',
      role: 'sales-manager',
      organizationId: ORGANIZATION_ID,
      permissions: ['inventory.cost.write'],
    }
    const rejected = await request(server())
      .post(
        `/blueprints/${PACKAGE_ID}/records/SalesOrder/${salesOrderId}/approvals/so-high-value/approve`,
      )
      .send({ role: 'gm' })
    expect(rejected.status).toBe(403)
    const stillThree = await request(server()).get('/inbox').expect(200)
    expect(stillThree.body).toHaveLength(3)

    await request(server())
      .post(
        `/blueprints/${PACKAGE_ID}/records/SalesOrder/${salesOrderId}/approvals/so-high-value/approve`,
      )
      .send({ role: 'sales-manager' })
      .expect(200)
    const afterApprove = await request(server()).get('/inbox').expect(200)
    expect(afterApprove.body).toHaveLength(2)
    expect(afterApprove.body.find((item: { entity: string }) => item.entity === 'SalesOrder')).toBeUndefined()

    const again = await request(server())
      .post(
        `/blueprints/${PACKAGE_ID}/records/SalesOrder/${salesOrderId}/approvals/so-high-value/approve`,
      )
      .send({ role: 'sales-manager' })
    expect(again.status).toBeGreaterThanOrEqual(400)
    const stillTwo = await request(server()).get('/inbox').expect(200)
    expect(stillTwo.body).toHaveLength(2)
  })
})
