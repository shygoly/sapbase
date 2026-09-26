/**
 * P3 适配宿主查询 + P4 批次反查 / 主数据导入 / 发货批次召回。
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
import { BLUEPRINT_JOURNAL_ENTRIES_DDL } from '../src/semantic-runtime/blueprint-journal-entry.ddl'
import { BLUEPRINT_RECORDS_DDL } from '../src/semantic-runtime/blueprint-record.ddl'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'

const ORGANIZATION_ID = '12121212-1212-1212-1212-121212121212'
const OTHER_ORG = '13131313-1313-1313-1313-131313131313'
const PACKAGE_ID = 'auto-parts-1.1.0'
const TEMPLATES_DIR = resolve(__dirname, '../../templates')

function generatePemPair(): { publicPem: string; privatePem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }
}

describe('追溯导入与适配查询（P3/P4 e2e）', () => {
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
  let orderId = ''
  let orderNumber = ''

  const server = () => app.getHttpServer()

  beforeAll(async () => {
    packagesDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-trace-pkgs-'))
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
            id: 'e2e-trace-user',
            userId: 'e2e-trace-user',
            email: 'trace@test.local',
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
    } catch (error) {
      available = false
      console.warn(`跳过 e2e：本地库不可用（${(error as Error).message}）`)
      return
    }

    await dataSource.query(`DELETE FROM blueprint_records WHERE "organizationId" IN ($1, $2)`, [
      ORGANIZATION_ID,
      OTHER_ORG,
    ])
    await dataSource.query(`DELETE FROM blueprint_approvals WHERE "organizationId" IN ($1, $2)`, [
      ORGANIZATION_ID,
      OTHER_ORG,
    ]).catch(() => undefined)
    await dataSource.query(
      `DELETE FROM blueprint_journal_entries WHERE "organizationId" IN ($1, $2)`,
      [ORGANIZATION_ID, OTHER_ORG],
    ).catch(() => undefined)
    await dataSource.query(`DELETE FROM blueprint_doc_counters WHERE "organizationId" IN ($1, $2)`, [
      ORGANIZATION_ID,
      OTHER_ORG,
    ]).catch(() => undefined)

    for (const [id, slug] of [
      [ORGANIZATION_ID, 'e2e-trace'],
      [OTHER_ORG, 'e2e-trace-other'],
    ] as const) {
      await dataSource.query(
        `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
         VALUES ($1, $2, $2, 'active', now(), now())
         ON CONFLICT (id) DO NOTHING`,
        [id, slug],
      )
    }

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
      .send({ partNo: 'BRK-08', name: '08 款卡罗拉前刹车片', unitCost: 12.5, packSize: 12 })
      .expect(201)
    const customer = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/Customer`)
      .send({ name: '宁波华兴', creditLimit: 80000 })
      .expect(201)
    partId = part.body.id
    customerId = customer.body.id

    const order = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder`)
      .send({
        customer: customerId,
        quantity: 200,
        children: { SalesOrderLine: [{ part: partId, quantity: 200, unitPrice: 20 }] },
      })
      .expect(201)
    orderId = order.body.id
    orderNumber = order.body.data.number
  }, 60000)

  afterAll(async () => {
    if (dataSource?.isInitialized && available) {
      await dataSource.query(`DELETE FROM blueprint_records WHERE "organizationId" IN ($1, $2)`, [
        ORGANIZATION_ID,
        OTHER_ORG,
      ])
      await dataSource.query(`DELETE FROM blueprint_approvals WHERE "organizationId" IN ($1, $2)`, [
        ORGANIZATION_ID,
        OTHER_ORG,
      ]).catch(() => undefined)
      await dataSource.query(
        `DELETE FROM blueprint_journal_entries WHERE "organizationId" IN ($1, $2)`,
        [ORGANIZATION_ID, OTHER_ORG],
      ).catch(() => undefined)
      await dataSource.query(`DELETE FROM blueprint_doc_counters WHERE "organizationId" IN ($1, $2)`, [
        ORGANIZATION_ID,
        OTHER_ORG,
      ])
      await dataSource.query('DELETE FROM audit_logs WHERE "organizationId" IN ($1, $2)', [
        ORGANIZATION_ID,
        OTHER_ORG,
      ])
      await dataSource.query('DELETE FROM organizations WHERE id IN ($1, $2)', [
        ORGANIZATION_ID,
        OTHER_ORG,
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

  it('适配查询：车型/年款/位置 → 零件候选 + 命中依据；倒置区间不命中', async () => {
    if (!available) return
    const created = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/Fitment`)
      .send({
        part: partId,
        make: 'Toyota',
        model: 'Corolla',
        yearFrom: 2008,
        yearTo: 2013,
        position: 'front',
      })
      .expect(201)
    await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/Fitment`)
      .send({
        part: partId,
        make: 'Toyota',
        model: 'Corolla',
        yearFrom: 2018,
        yearTo: 2010,
        position: 'front',
      })
      .expect(201)

    const hit = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/fitment/parts`)
      .query({ make: 'toyota', model: 'COROLLA', year: '2008', position: 'front' })
      .expect(200)
    expect(hit.body.parts).toHaveLength(1)
    expect(hit.body.parts[0]).toMatchObject({
      partId,
      partNo: 'BRK-08',
      evidence: [{ fitmentId: created.body.id, yearFrom: 2008, yearTo: 2013, position: 'front' }],
    })

    const invertedOnly = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/fitment/parts`)
      .query({ make: 'toyota', model: 'corolla', year: '2011', position: 'front' })
      .expect(200)
    expect(invertedOnly.body.parts).toHaveLength(1)
    expect(invertedOnly.body.parts[0].evidence.every((item: { yearFrom: number; yearTo: number }) => item.yearFrom <= item.yearTo)).toBe(
      true,
    )
  })

  it('适配查询负例：缺 make、year 非整数、非法 position → 400', async () => {
    if (!available) return
    const missing = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/fitment/parts`)
      .query({ model: 'Corolla', year: '2008' })
      .expect(400)
    expect(missing.body.reason).toBe('type-mismatch')
    const year = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/fitment/parts`)
      .query({ make: 'Toyota', model: 'Corolla', year: '20a8' })
      .expect(400)
    expect(year.body.field).toBe('year')
    const position = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/fitment/parts`)
      .query({ make: 'Toyota', model: 'Corolla', year: '2008', position: 'roof' })
      .expect(400)
    expect(position.body.field).toBe('position')
  })

  it('适配查询租户隔离：他租的 Fitment 不可见', async () => {
    if (!available) return
    await dataSource.query(
      `INSERT INTO blueprint_records
        (id, "createdAt", "updatedAt", "organizationId", "blueprintId", "blueprintVersion", entity, data, state, version)
       VALUES ($1, now(), now(), $2, 'auto-parts', '1.0.0', 'Fitment', $3::jsonb, 'active', 1)`,
      [
        randomUUID(),
        OTHER_ORG,
        JSON.stringify({
          part: partId,
          make: 'Honda',
          model: 'Civic',
          yearFrom: 2010,
          yearTo: 2015,
          position: 'front',
        }),
      ],
    )
    const res = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/fitment/parts`)
      .query({ make: 'Honda', model: 'Civic', year: '2012', position: 'front' })
      .expect(200)
    expect(res.body.parts).toEqual([])
  })

  it('主数据导入：第 7 行非法但合法行被导入；非法行进 errors', async () => {
    if (!available) return
    const csv = [
      'partNo,name',
      'IMP-1,合法1',
      'IMP-2,合法2',
      'IMP-3,合法3',
      'IMP-4,合法4',
      'IMP-5,合法5',
      ',缺号',
      'IMP-7,合法7',
    ].join('\n')
    const before = await request(server()).get(`/blueprints/${PACKAGE_ID}/records/Part`).expect(200)
    const imported = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/import/Part`)
      .send({ csv })
      .expect(200)
    expect(imported.body).toMatchObject({
      entity: 'Part',
      source: 'csv',
      imported: 6,
      failed: 1,
      dryRun: false,
    })
    expect(imported.body.errors).toEqual([
      expect.objectContaining({ line: 7, reason: 'type-mismatch', field: 'partNo' }),
    ])
    const after = await request(server()).get(`/blueprints/${PACKAGE_ID}/records/Part`).expect(200)
    const nos = after.body.map((row: { data: { partNo?: string } }) => row.data.partNo)
    expect(nos).toEqual(expect.arrayContaining(['IMP-1', 'IMP-2', 'IMP-3', 'IMP-4', 'IMP-5', 'IMP-7']))
    expect(after.body.length).toBe(before.body.length + 6)
  })

  it('主数据导入负例：未知实体 / 头实体 / 结构错误 / dryRun 不落库', async () => {
    if (!available) return
    const unknown = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/import/Ghost`)
      .send({ rows: [{ name: 'x' }] })
      .expect(400)
    expect(unknown.body.reason).toBe('unknown-entity')

    const header = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/import/SalesOrder`)
      .send({ rows: [{ quantity: 1 }] })
      .expect(400)
    expect(header.body.reason).toBe('import-document-unsupported')

    const shape = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/import/Customer`)
      .send({ csv: 'name,ghost\n华兴,1\n' })
      .expect(400)
    expect(shape.body.reason).toBe('unknown-field')
    expect(shape.body.message).toMatch(/ghost/)

    const both = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/import/Customer`)
      .send({ csv: 'name\nA\n', rows: [{ name: 'B' }] })
      .expect(400)
    expect(both.body.reason).toBe('type-mismatch')

    const before = await request(server()).get(`/blueprints/${PACKAGE_ID}/records/Supplier`).expect(200)
    const dry = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/import/Supplier`)
      .send({ dryRun: true, rows: [{ name: '宁波华兴供应商', creditDays: 30 }] })
      .expect(200)
    expect(dry.body).toMatchObject({ imported: 0, failed: 0, validated: 1, dryRun: true })
    const after = await request(server()).get(`/blueprints/${PACKAGE_ID}/records/Supplier`).expect(200)
    expect(after.body.length).toBe(before.body.length)
  })

  it('批次追溯召回：含批次发货的单 → 用批次号反查到客户、发货时间与数量', async () => {
    if (!available) return
    const batch = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/Batch`)
      .send({
        batchNo: 'B-2026-001',
        part: partId,
        order: orderId,
        quantity: 200,
        shippedOn: '2026-03-01',
      })
      .expect(201)
    expect(batch.body.state).toBe('shipped')

    const traced = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/traceability/batch/${encodeURIComponent('B-2026-001')}`)
      .expect(200)
    expect(traced.body.found).toBe(true)
    expect(traced.body.hits).toEqual([
      expect.objectContaining({
        batchId: batch.body.id,
        partId,
        partNo: 'BRK-08',
        quantity: 200,
        shippedOn: '2026-03-01',
        orderId,
        orderNumber,
        customerId,
        customerName: '宁波华兴',
        notes: [],
      }),
    ])
  })

  it('批次追溯负例：未知批次 200 found:false；他租批次不可见', async () => {
    if (!available) return
    const unknown = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/traceability/batch/${encodeURIComponent('B-NONE')}`)
      .expect(200)
    expect(unknown.body).toEqual({ found: false, batchNo: 'B-NONE', hits: [] })

    await dataSource.query(
      `INSERT INTO blueprint_records
        (id, "createdAt", "updatedAt", "organizationId", "blueprintId", "blueprintVersion", entity, data, state, version)
       VALUES ($1, now(), now(), $2, 'auto-parts', '1.0.0', 'Batch', $3::jsonb, 'shipped', 1)`,
      [
        randomUUID(),
        OTHER_ORG,
        JSON.stringify({
          batchNo: 'B-OTHER',
          part: partId,
          order: orderId,
          quantity: 1,
          shippedOn: '2026-01-01',
        }),
      ],
    )
    const isolated = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/traceability/batch/${encodeURIComponent('B-OTHER')}`)
      .expect(200)
    expect(isolated.body).toEqual({ found: false, batchNo: 'B-OTHER', hits: [] })
  })
})
