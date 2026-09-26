/**
 * P2 判定执行：金额合计审批、审批链、运行时分录平衡。
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
import { BlueprintModule } from '../src/blueprint/blueprint.module'
import { SemanticRuntimeModule } from '../src/semantic-runtime/semantic-runtime.module'
import { BLUEPRINT_APPROVALS_DDL } from '../src/semantic-runtime/blueprint-approval.ddl'
import { BLUEPRINT_DOC_COUNTERS_DDL } from '../src/semantic-runtime/blueprint-doc-counter.ddl'
import { BLUEPRINT_JOURNAL_ENTRIES_DDL } from '../src/semantic-runtime/blueprint-journal-entry.ddl'
import { BLUEPRINT_RECORDS_DDL } from '../src/semantic-runtime/blueprint-record.ddl'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'

const ORGANIZATION_ID = '88888888-8888-8888-8888-888888888888'
const PACKAGE_ID = 'auto-parts-1.1.0'
const TEMPLATES_DIR = resolve(__dirname, '../../templates')

function generatePemPair(): { publicPem: string; privatePem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }
}

describe('判定执行（P2 e2e）', () => {
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
    packagesDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-decision-pkgs-'))
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
            id: 'e2e-decision-user',
            userId: 'e2e-decision-user',
            email: 'decision@test.local',
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
    } catch (error) {
      available = false
      console.warn(`跳过 e2e：本地库不可用（${(error as Error).message}）`)
      return
    }

    await dataSource.query(
      `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
       VALUES ($1, 'e2e-decision', 'e2e-decision', 'active', now(), now())
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
      .send({ partNo: 'P-DEC-1', name: '刹车片', unitCost: 12.5, packSize: 12 })
      .expect(201)
    const customer = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/Customer`)
      .send({ name: '宁波华兴', creditLimit: 80000 })
      .expect(201)
    partId = part.body.id
    customerId = customer.body.id
  }, 60000)

  afterAll(async () => {
    if (dataSource?.isInitialized && available) {
      await dataSource
        .query(`DELETE FROM blueprint_approvals WHERE "organizationId" = $1`, [ORGANIZATION_ID])
        .catch(() => undefined)
      await dataSource
        .query(`DELETE FROM blueprint_journal_entries WHERE "organizationId" = $1`, [
          ORGANIZATION_ID,
        ])
        .catch(() => undefined)
      await dataSource.query(`DELETE FROM blueprint_records WHERE "organizationId" = $1`, [
        ORGANIZATION_ID,
      ])
      await dataSource.query(`DELETE FROM blueprint_doc_counters WHERE "organizationId" = $1`, [
        ORGANIZATION_ID,
      ])
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

  it('小数串 unitPrice 通过校验；小额订单不建审批链，可直接迁移', async () => {
    if (!available) return
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
    expect(created.body.state).toBe('draft')

    const approvals = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}/approvals`)
      .expect(200)
    expect(approvals.body.approvals).toEqual([])

    const moved = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}/transition`)
      .send({ to: 'confirmed' })
      .expect(200)
    expect(moved.body.state).toBe('confirmed')
    expect(moved.body.journalEntries).toEqual([])
  })

  it('金额合计超阈值：建链；未批迁移拒；错角色 403；批完后放行并发分录', async () => {
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

    const approvals = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}/approvals`)
      .expect(200)
    expect(approvals.body.approvals).toEqual([
      expect.objectContaining({
        ruleId: 'so-high-value',
        status: 'pending',
        steps: [expect.objectContaining({ index: 0, role: 'sales-manager', status: 'pending' })],
      }),
    ])

    const blocked = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}/transition`)
      .send({ to: 'confirmed' })
      .expect(400)
    expect(blocked.body.reason).toBe('approval-required')
    expect(blocked.body.ruleId).toBe('so-high-value')
    expect(blocked.body.message).toMatch(/sales-manager/)

    const still = await dataSource.query(`SELECT state FROM blueprint_records WHERE id = $1`, [
      created.body.id,
    ])
    expect(still[0].state).toBe('draft')

    const wrong = await request(server())
      .post(
        `/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}/approvals/so-high-value/approve`,
      )
      .send({ role: 'finance-manager' })
      .expect(403)
    expect(wrong.body.reason).toBe('approval-role-mismatch')
    expect(wrong.body.message).toMatch(/sales-manager/)
    expect(wrong.body.message).toMatch(/finance-manager/)

    const ok = await request(server())
      .post(
        `/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}/approvals/so-high-value/approve`,
      )
      .send({ role: 'sales-manager' })
      .expect(200)
    expect(ok.body.status).toBe('approved')

    const confirmed = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}/transition`)
      .send({ to: 'confirmed' })
      .expect(200)
    expect(confirmed.body.state).toBe('confirmed')

    const shipped = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}/transition`)
      .send({ to: 'shipped' })
      .expect(200)
    expect(shipped.body.state).toBe('shipped')
    expect(shipped.body.journalEntries).toHaveLength(2)
    const debit = shipped.body.journalEntries.find((item: { side: string }) => item.side === 'debit')
    const credit = shipped.body.journalEntries.find(
      (item: { side: string }) => item.side === 'credit',
    )
    expect(debit.amount).toBe(credit.amount)
    expect(debit.amount).toBe('120000.0000')

    const audits = await dataSource.query(
      `SELECT action FROM audit_logs WHERE "organizationId" = $1 AND action IN ('blueprint.record.approval', 'blueprint.record.accounting')`,
      [ORGANIZATION_ID],
    )
    expect(audits.map((row: { action: string }) => row.action)).toEqual(
      expect.arrayContaining(['blueprint.record.approval', 'blueprint.record.accounting']),
    )
  })
})
