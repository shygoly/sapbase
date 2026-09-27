/**
 * N0 Outbox：同事务发布、至少一次投递、订阅者去重、失败可查、重启后仍可投。
 */
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import request from 'supertest'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { AtomicRegistryModule } from '../src/atomic-registry/atomic-registry.module'
import { AtomicRuntimeModule } from '../src/atomic-runtime/atomic-runtime.module'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'
import { BlueprintModule } from '../src/blueprint/blueprint.module'
import { EventBusService } from '../src/common/events/event-bus.service'
import type { IEventHandler } from '../src/common/events/i-event-handler'
import { OutboxDispatcherService } from '../src/outbox/outbox-dispatcher.service'
import { OUTBOX_DDL } from '../src/outbox/outbox.ddl'
import { NOTIFICATIONS_DDL } from '../src/notifications/notification.ddl'
import { OutboxEvent } from '../src/outbox/outbox-event.entity'
import { OutboxService } from '../src/outbox/outbox.service'
import { BLUEPRINT_APPROVALS_DDL } from '../src/semantic-runtime/blueprint-approval.ddl'
import { BLUEPRINT_DOC_COUNTERS_DDL } from '../src/semantic-runtime/blueprint-doc-counter.ddl'
import { BLUEPRINT_JOURNAL_ENTRIES_DDL } from '../src/semantic-runtime/blueprint-journal-entry.ddl'
import { BLUEPRINT_RECORDS_DDL } from '../src/semantic-runtime/blueprint-record.ddl'
import { RecordWriteError, SemanticRuntimeService } from '../src/semantic-runtime/semantic-runtime.service'
import { SemanticRuntimeModule } from '../src/semantic-runtime/semantic-runtime.module'

const ORGANIZATION_ID = '99999999-9999-9999-9999-999999999999'
const PACKAGE_ID = 'auto-parts-1.1.0'
const TEMPLATES_DIR = resolve(__dirname, '../../templates')

function generatePemPair(): { publicPem: string; privatePem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }
}

describe('Outbox（N0 e2e）', () => {
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

  const server = () => app.getHttpServer()

  beforeAll(async () => {
    packagesDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-outbox-pkgs-'))
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
          context.switchToHttp().getRequest().user = {
            id: 'e2e-outbox-user',
            userId: 'e2e-outbox-user',
            email: 'outbox@test.local',
            organizationId: ORGANIZATION_ID,
            permissions: ['inventory.cost.write'],
          }
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

    await dataSource.query(
      `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
       VALUES ($1, 'e2e-outbox', 'e2e-outbox', 'active', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [ORGANIZATION_ID],
    )

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
      .send({ partNo: 'P-OUTBOX-1', name: '垫片', unitCost: 12.5, packSize: 12 })
      .expect(201)
    const customer = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/Customer`)
      .send({ name: '出盒测试客户', creditLimit: 80000 })
      .expect(201)
    partId = part.body.id
    customerId = customer.body.id
  }, 60000)

  afterAll(async () => {
    if (dataSource?.isInitialized && available) {
      await dataSource
        .query(`DELETE FROM outbox_deliveries WHERE "eventId" IN (SELECT id FROM outbox_events WHERE "organizationId" = $1)`, [
          ORGANIZATION_ID,
        ])
        .catch(() => undefined)
      await dataSource
        .query(`DELETE FROM outbox_events WHERE "organizationId" = $1`, [ORGANIZATION_ID])
        .catch(() => undefined)
      await dataSource
        .query(`DELETE FROM blueprint_approvals WHERE "organizationId" = $1`, [ORGANIZATION_ID])
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
      await dataSource.query('DELETE FROM audit_logs WHERE "organizationId" = $1', [ORGANIZATION_ID])
      await dataSource.query('DELETE FROM organizations WHERE id = $1', [ORGANIZATION_ID])
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

  it('业务回滚不留事件：发布后记账失败（发布先于失败）', async () => {
    if (!available) return
    const runtime = app.get(SemanticRuntimeService)
    const original = runtime['postAccounting'].bind(runtime)
    runtime['postAccounting'] = async () => {
      throw new RecordWriteError('injected-unbalanced', 'accounting-unbalanced')
    }
    let recordId = ''
    try {
      const created = await request(server())
        .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder`)
        .send({
          customer: customerId,
          quantity: 2,
          children: {
            SalesOrderLine: [{ quantity: 2, unitPrice: '20.0000', part: partId }],
          },
        })
        .expect(201)
      recordId = created.body.id
      const moved = await request(server())
        .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${recordId}/transition`)
        .send({ to: 'confirmed' })
      expect(moved.status).toBe(400)
      expect(moved.body.reason).toBe('accounting-unbalanced')
      const rows = await dataSource.query(
        `SELECT id FROM outbox_events WHERE "organizationId" = $1 AND "aggregateId" = $2 AND topic = 'blueprint.record.transitioned'`,
        [ORGANIZATION_ID, recordId],
      )
      expect(rows).toHaveLength(0)
      const still = await dataSource.query(`SELECT state FROM blueprint_records WHERE id = $1`, [
        recordId,
      ])
      expect(still[0].state).toBe('draft')
    } finally {
      runtime['postAccounting'] = original
    }
  })

  it('迁移 / 审批待审 / 审批决定 / 导入完成 都落 outbox', async () => {
    if (!available) return
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
    const pending = await dataSource.query(
      `SELECT topic, payload FROM outbox_events WHERE "organizationId" = $1 AND "aggregateId" = $2 AND topic = 'blueprint.record.approval.pending'`,
      [ORGANIZATION_ID, created.body.id],
    )
    expect(pending).toHaveLength(1)
    expect(pending[0].payload).toMatchObject({
      ruleId: 'so-high-value',
      role: 'sales-manager',
      stepIndex: 0,
      entity: 'SalesOrder',
      recordId: created.body.id,
    })

    await request(server())
      .post(
        `/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}/approvals/so-high-value/approve`,
      )
      .send({ role: 'sales-manager' })
      .expect(200)
    const decided = await dataSource.query(
      `SELECT topic FROM outbox_events WHERE "organizationId" = $1 AND "aggregateId" = $2 AND topic = 'blueprint.record.approval.decided'`,
      [ORGANIZATION_ID, created.body.id],
    )
    expect(decided).toHaveLength(1)

    const moved = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}/transition`)
      .send({ to: 'confirmed' })
      .expect(200)
    expect(moved.body.state).toBe('confirmed')
    const transitioned = await dataSource.query(
      `SELECT payload FROM outbox_events WHERE "organizationId" = $1 AND "aggregateId" = $2 AND topic = 'blueprint.record.transitioned'`,
      [ORGANIZATION_ID, created.body.id],
    )
    expect(transitioned).toHaveLength(1)
    expect(transitioned[0].payload).toMatchObject({
      entity: 'SalesOrder',
      recordId: created.body.id,
      from: 'draft',
      to: 'confirmed',
    })

    await request(server())
      .post(`/blueprints/${PACKAGE_ID}/import/Part`)
      .send({ csv: 'partNo,name\nP-OUTBOX-IMP,导入件\n' })
      .expect(200)
    const imported = await dataSource.query(
      `SELECT payload FROM outbox_events WHERE "organizationId" = $1 AND topic = 'blueprint.import.completed'`,
      [ORGANIZATION_ID],
    )
    expect(imported.length).toBeGreaterThanOrEqual(1)
    expect(imported[imported.length - 1].payload).toMatchObject({
      entity: 'Part',
      imported: 1,
      failed: 0,
      dryRun: false,
    })
  })

  it('重复投递只处理一次；新实例仍可 drain（重启恢复）', async () => {
    if (!available) return
    const outbox = app.get(OutboxService)
    const eventBus = app.get(EventBusService)
    class CountingHandler implements IEventHandler<{ topic: string; payload: unknown }> {
      public calls = 0
      async handle(): Promise<void> {
        this.calls += 1
      }
    }
    const handler = new CountingHandler()
    eventBus.subscribe('blueprint.outbox.restart', handler)
    const written = await dataSource.transaction(async (manager) =>
      outbox.publish(manager, {
        topic: 'blueprint.outbox.restart',
        organizationId: ORGANIZATION_ID,
        idempotencyKey: `restart:${Date.now()}`,
        payload: { probe: true },
      }),
    )
    const fresh = new OutboxDispatcherService(dataSource, eventBus)
    await fresh.drain()
    expect(handler.calls).toBe(1)
    const row = await dataSource.getRepository(OutboxEvent).findOneByOrFail({ id: written.id })
    expect(row.status).toBe('delivered')

    row.status = 'pending'
    row.deliveredAt = null
    row.nextAttemptAt = new Date(0)
    await dataSource.getRepository(OutboxEvent).save(row)
    const another = new OutboxDispatcherService(dataSource, eventBus)
    await another.drain()
    expect(handler.calls).toBe(1)
  })

  it('投递失败可查且可手动重投', async () => {
    if (!available) return
    const outbox = app.get(OutboxService)
    const eventBus = app.get(EventBusService)
    const dispatcher = app.get(OutboxDispatcherService)
    class BoomHandler implements IEventHandler<{ topic: string; payload: unknown }> {
      async handle(): Promise<void> {
        throw new Error('subscriber-boom')
      }
    }
    eventBus.subscribe('blueprint.outbox.fail', new BoomHandler())
    const written = await dataSource.transaction(async (manager) =>
      outbox.publish(manager, {
        topic: 'blueprint.outbox.fail',
        organizationId: ORGANIZATION_ID,
        idempotencyKey: `fail:${Date.now()}`,
        payload: { probe: true },
      }),
    )
    await dispatcher.drain()
    const listed = await request(server())
      .get(`/outbox/events?status=pending&organizationId=${ORGANIZATION_ID}`)
      .expect(200)
    const failedRow = listed.body.events.find((item: { id: string }) => item.id === written.id)
    expect(failedRow).toMatchObject({
      id: written.id,
      lastError: 'subscriber-boom',
    })
    expect(failedRow.attempts).toBeGreaterThanOrEqual(1)

    const reset = await request(server())
      .post(`/outbox/events/${written.id}/redeliver?organizationId=${ORGANIZATION_ID}`)
      .expect(201)
    expect(reset.body.status).toBe('pending')
    expect(reset.body.attempts).toBe(failedRow.attempts)
  })

  it('排障闭环：失败可见 attempts/lastError → 手动重投 → drain 转 delivered', async () => {
    if (!available) return
    const outbox = app.get(OutboxService)
    const eventBus = app.get(EventBusService)
    const dispatcher = app.get(OutboxDispatcherService)
    let shouldFail = true
    class FlakyHandler implements IEventHandler<{ topic: string; payload: unknown }> {
      async handle(): Promise<void> {
        if (shouldFail) throw new Error('flaky-once')
      }
    }
    eventBus.subscribe('blueprint.outbox.loop', new FlakyHandler())
    const written = await dataSource.transaction(async (manager) =>
      outbox.publish(manager, {
        topic: 'blueprint.outbox.loop',
        organizationId: ORGANIZATION_ID,
        idempotencyKey: `loop:${Date.now()}`,
        payload: { probe: true },
      }),
    )
    await dispatcher.drain()
    const listed = await request(server())
      .get(`/outbox/events?organizationId=${ORGANIZATION_ID}`)
      .expect(200)
    const failedRow = listed.body.events.find((item: { id: string }) => item.id === written.id)
    expect(failedRow).toMatchObject({ lastError: 'flaky-once' })
    expect(failedRow.attempts).toBeGreaterThanOrEqual(1)
    expect(failedRow.status).not.toBe('delivered')

    await request(server())
      .post(`/outbox/events/${written.id}/redeliver?organizationId=${ORGANIZATION_ID}`)
      .expect(201)
    shouldFail = false
    await dispatcher.drain()
    const row = await dataSource.getRepository(OutboxEvent).findOneByOrFail({ id: written.id })
    expect(row.status).toBe('delivered')
    expect(row.lastError).toBeNull()
  })
})
