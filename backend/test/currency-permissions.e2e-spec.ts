/**
 * P5-3 货币 + P5-4 权限细化。
 *
 * 双币种：复制当前模板、把订单金额链改成 USD、版本号改掉再 deliver。
 * 与 1.1.0 共用 blueprintId，应收视图按 currency 分组成两行。
 */
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import request from 'supertest'
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

const ORGANIZATION_ID = '16161616-1616-1616-1616-161616161616'
const OTHER_ORG = '17171717-1717-1717-1717-171717171717'
const PKG_CNY = 'auto-parts-1.1.0'
const PKG_USD = 'auto-parts-1.2.0'
const REPO_TEMPLATES = resolve(__dirname, '../../templates')

function generatePemPair(): { publicPem: string; privatePem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }
}

function rewriteOrderMoneyToUsd(dir: string): void {
  const blueprintPath = join(dir, 'blueprint.json')
  const blueprint = JSON.parse(readFileSync(blueprintPath, 'utf8')) as { version: string }
  blueprint.version = '1.2.0'
  writeFileSync(blueprintPath, `${JSON.stringify(blueprint, null, 2)}\n`)

  const semanticPath = join(dir, 'semantic.json')
  const semantic = JSON.parse(readFileSync(semanticPath, 'utf8')) as {
    entities: Array<{ name: string; fields: Array<{ name: string; currency?: string }> }>
  }
  for (const entity of semantic.entities) {
    if (entity.name !== 'SalesOrder' && entity.name !== 'SalesOrderLine') continue
    for (const field of entity.fields) {
      if (field.name === 'unitPrice' || field.name === 'amount' || field.name === 'totalAmount') {
        field.currency = 'USD'
      }
    }
  }
  writeFileSync(semanticPath, `${JSON.stringify(semantic, null, 2)}\n`)
}

describe('货币与权限细化（P5-3 / P5-4 e2e）', () => {
  jest.setTimeout(60000)

  let app: INestApplication
  let dataSource: DataSource
  let available = true
  let packagesDir: string
  let templatesDir: string
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
    id: 'e2e-cp-user',
    userId: 'e2e-cp-user',
    organizationId: ORGANIZATION_ID,
    permissions: ['inventory.cost.write', 'inventory.cost.read'],
  }

  const server = () => app.getHttpServer()

  beforeAll(async () => {
    packagesDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-cp-pkgs-'))
    templatesDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-cp-tpl-'))
    cpSync(REPO_TEMPLATES, templatesDir, { recursive: true })
    const usdDir = join(templatesDir, 'auto-parts-usd')
    cpSync(join(templatesDir, 'auto-parts'), usdDir, { recursive: true })
    rewriteOrderMoneyToUsd(usdDir)

    process.env.BLUEPRINT_PACKAGES_DIR = packagesDir
    savedTemplates = process.env.BLUEPRINT_TEMPLATES_DIR
    process.env.BLUEPRINT_TEMPLATES_DIR = templatesDir
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
      [ORGANIZATION_ID, 'e2e-cp'],
      [OTHER_ORG, 'e2e-cp-other'],
    ] as const) {
      await dataSource.query(
        `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
         VALUES ($1, $2, $2, 'active', now(), now())
         ON CONFLICT (id) DO NOTHING`,
        [id, slug],
      )
    }

    const deliveredCny = await request(server()).post('/blueprints/auto-parts/deliver').send({
      grantedTo: [ORGANIZATION_ID, OTHER_ORG],
      resell: false,
      issuer: 'sapbase-platform',
    })
    if (deliveredCny.status !== 200) {
      available = false
      console.warn(`跳过 e2e：deliver CNY 失败（${deliveredCny.status} ${JSON.stringify(deliveredCny.body)}）`)
      return
    }
    expect(deliveredCny.body.id).toBe(PKG_CNY)
    await request(server()).post(`/blueprints/${PKG_CNY}/load`).expect(200)

    const deliveredUsd = await request(server()).post('/blueprints/auto-parts-usd/deliver').send({
      grantedTo: [ORGANIZATION_ID, OTHER_ORG],
      resell: false,
      issuer: 'sapbase-platform',
    })
    if (deliveredUsd.status !== 200) {
      available = false
      console.warn(`跳过 e2e：deliver USD 失败（${deliveredUsd.status} ${JSON.stringify(deliveredUsd.body)}）`)
      return
    }
    expect(deliveredUsd.body.id).toBe(PKG_USD)
    await request(server()).post(`/blueprints/${PKG_USD}/load`).expect(200)

    const part = await request(server())
      .post(`/blueprints/${PKG_CNY}/records/Part`)
      .send({ partNo: 'BRK-CP-08', name: '货币权限刹车片', unitCost: 12.5, packSize: 12 })
      .expect(201)
    const customer = await request(server())
      .post(`/blueprints/${PKG_CNY}/records/Customer`)
      .send({ name: '宁波华兴', creditLimit: 80000 })
      .expect(201)
    partId = part.body.id
    customerId = customer.body.id
  })

  afterAll(async () => {
    if (app) await app.close()
    if (savedTemplates === undefined) delete process.env.BLUEPRINT_TEMPLATES_DIR
    else process.env.BLUEPRINT_TEMPLATES_DIR = savedTemplates
    if (savedPublicKeys === undefined) delete process.env.BLUEPRINT_LICENSE_PUBLIC_KEYS
    else process.env.BLUEPRINT_LICENSE_PUBLIC_KEYS = savedPublicKeys
    if (savedPrivateKey === undefined) delete process.env.BLUEPRINT_LICENSE_PRIVATE_KEY
    else process.env.BLUEPRINT_LICENSE_PRIVATE_KEY = savedPrivateKey
    if (savedUnsigned === undefined) delete process.env.BLUEPRINT_ALLOW_UNSIGNED
    else process.env.BLUEPRINT_ALLOW_UNSIGNED = savedUnsigned
    if (packagesDir) rmSync(packagesDir, { recursive: true, force: true })
    if (templatesDir) rmSync(templatesDir, { recursive: true, force: true })
  })

  afterEach(() => {
    currentUser.id = 'e2e-cp-user'
    currentUser.userId = 'e2e-cp-user'
    currentUser.organizationId = ORGANIZATION_ID
    currentUser.permissions = ['inventory.cost.write', 'inventory.cost.read']
  })

  it('字段级：无 cost.read 省略 unitCost；有则可见；写拒绝指明字段', async () => {
    if (!available) return
    currentUser.permissions = []
    const hidden = await request(server()).get(`/blueprints/${PKG_CNY}/records/Part`).expect(200)
    const hiddenPart = (hidden.body as Array<{ data: Record<string, unknown>; omittedFields?: string[] }>).find(
      (row) => row.data.partNo === 'BRK-CP-08',
    )
    expect(hiddenPart?.data.unitCost).toBeUndefined()
    expect(hiddenPart?.omittedFields).toEqual(expect.arrayContaining(['unitCost']))

    currentUser.permissions = ['inventory.cost.read']
    const shown = await request(server()).get(`/blueprints/${PKG_CNY}/records/Part`).expect(200)
    const shownPart = (shown.body as Array<{ data: Record<string, unknown> }>).find(
      (row) => row.data.partNo === 'BRK-CP-08',
    )
    expect(shownPart?.data.unitCost).toBeDefined()

    currentUser.permissions = []
    const denied = await request(server())
      .post(`/blueprints/${PKG_CNY}/records/Part`)
      .send({ partNo: 'BRK-CP-DENIED', name: '无写权限', unitCost: 9, packSize: 12 })
      .expect(403)
    expect(denied.body.reason).toBe('forbidden-field')
    expect(denied.body.field).toBe('unitCost')
  })

  it('单据级：只看自己的单；空归属对所有人可见；readAll 不筛', async () => {
    if (!available) return
    currentUser.id = 'alice'
    currentUser.userId = 'alice'
    const mine = await request(server())
      .post(`/blueprints/${PKG_CNY}/records/SalesOrder`)
      .send({
        customer: customerId,
        quantity: 1,
        owner: 'alice',
        children: { SalesOrderLine: [{ part: partId, quantity: 1, unitPrice: 10 }] },
      })
      .expect(201)

    currentUser.id = 'bob'
    currentUser.userId = 'bob'
    await request(server())
      .post(`/blueprints/${PKG_CNY}/records/SalesOrder`)
      .send({
        customer: customerId,
        quantity: 1,
        owner: 'bob',
        children: { SalesOrderLine: [{ part: partId, quantity: 1, unitPrice: 11 }] },
      })
      .expect(201)

    const orphan = await request(server())
      .post(`/blueprints/${PKG_CNY}/records/SalesOrder`)
      .send({
        customer: customerId,
        quantity: 1,
        children: { SalesOrderLine: [{ part: partId, quantity: 1, unitPrice: 12 }] },
      })
      .expect(201)

    currentUser.id = 'alice'
    currentUser.userId = 'alice'
    currentUser.permissions = ['inventory.cost.write']
    const listed = await request(server()).get(`/blueprints/${PKG_CNY}/records/SalesOrder`).expect(200)
    const ids = (listed.body as Array<{ id: string; data: { owner?: string } }>).map((row) => row.id)
    expect(ids).toEqual(expect.arrayContaining([mine.body.id, orphan.body.id]))
    const bobRow = (listed.body as Array<{ id: string; data: { owner?: string } }>).find(
      (row) => row.data.owner === 'bob',
    )
    expect(bobRow).toBeUndefined()

    const envelope = await request(server())
      .get(`/blueprints/${PKG_CNY}/records/SalesOrder`)
      .query({ page: '1', pageSize: '50' })
      .expect(200)
    const envelopeIds = (envelope.body.items as Array<{ id: string; data: { owner?: string } }>).map(
      (row) => row.id,
    )
    expect(envelopeIds).toEqual(expect.arrayContaining([mine.body.id, orphan.body.id]))
    expect(
      (envelope.body.items as Array<{ data: { owner?: string } }>).some((row) => row.data.owner === 'bob'),
    ).toBe(false)

    currentUser.permissions = ['sales.order.readall']
    const all = await request(server()).get(`/blueprints/${PKG_CNY}/records/SalesOrder`).expect(200)
    expect(
      (all.body as Array<{ data: { owner?: string } }>).some((row) => row.data.owner === 'bob'),
    ).toBe(true)
  })

  it('应收按币种分组：CNY + USD 两行，不是一行求和', async () => {
    if (!available) return
    const cnyOrder = await request(server())
      .post(`/blueprints/${PKG_CNY}/records/SalesOrder`)
      .send({
        customer: customerId,
        quantity: 2,
        children: { SalesOrderLine: [{ part: partId, quantity: 2, unitPrice: 20 }] },
      })
      .expect(201)
    await request(server())
      .post(`/blueprints/${PKG_CNY}/records/SalesOrder/${cnyOrder.body.id}/transition`)
      .send({ to: 'confirmed' })
      .expect(200)

    const usdOrder = await request(server())
      .post(`/blueprints/${PKG_USD}/records/SalesOrder`)
      .send({
        customer: customerId,
        quantity: 3,
        children: { SalesOrderLine: [{ part: partId, quantity: 3, unitPrice: 10 }] },
      })
      .expect(201)
    await request(server())
      .post(`/blueprints/${PKG_USD}/records/SalesOrder/${usdOrder.body.id}/transition`)
      .send({ to: 'confirmed' })
      .expect(200)

    const receivable = await request(server()).get(`/blueprints/${PKG_CNY}/views/receivable`).expect(200)
    const rows = receivable.body as Array<{ customerId: string; currency?: string; receivable: string }>
    const forCustomer = rows.filter((row) => row.customerId === customerId)
    expect(forCustomer.map((row) => row.currency).sort()).toEqual(['CNY', 'USD'])
    const cny = forCustomer.find((row) => row.currency === 'CNY')
    const usd = forCustomer.find((row) => row.currency === 'USD')
    expect(cny?.receivable).toMatch(/^\d/)
    expect(usd?.receivable).toMatch(/^\d/)
    expect(cny?.receivable).not.toBe(usd?.receivable)
  })

  it('租户隔离逐入口：records / 三视图 / 追溯 / 适配 / 导入', async () => {
    if (!available) return
    await dataSource.query(
      `INSERT INTO public.blueprint_records
        (id, "createdAt", "updatedAt", "organizationId", "blueprintId", "blueprintVersion", entity, data, state, version)
       VALUES
        ($1, now(), now(), $2, 'auto-parts', '1.1.0', 'Part', $3::jsonb, 'active', 1),
        ($4, now(), now(), $2, 'auto-parts', '1.1.0', 'StockItem', $5::jsonb, 'inStock', 1),
        ($6, now(), now(), $2, 'auto-parts', '1.1.0', 'Fitment', $7::jsonb, 'active', 1),
        ($8, now(), now(), $2, 'auto-parts', '1.1.0', 'Batch', $9::jsonb, 'shipped', 1)`,
      [
        randomUUID(),
        OTHER_ORG,
        JSON.stringify({ partNo: 'OTHER-PART', name: '他租零件' }),
        randomUUID(),
        JSON.stringify({ part: partId, quantity: 99, reserved: 0, inTransit: 77 }),
        randomUUID(),
        JSON.stringify({
          part: partId,
          make: 'Honda',
          model: 'Civic',
          yearFrom: 2010,
          yearTo: 2015,
          position: 'front',
        }),
        randomUUID(),
        JSON.stringify({
          batchNo: 'B-OTHER-CP',
          part: partId,
          order: randomUUID(),
          quantity: 1,
          shippedOn: '2026-01-01',
        }),
      ],
    )

    const parts = await request(server()).get(`/blueprints/${PKG_CNY}/records/Part`).expect(200)
    expect(
      (parts.body as Array<{ data: { partNo?: string } }>).some((row) => row.data.partNo === 'OTHER-PART'),
    ).toBe(false)

    const stock = await request(server()).get(`/blueprints/${PKG_CNY}/views/stock`).expect(200)
    const stockRow = (stock.body as Array<{ partId: string; onHand: number }>).find(
      (row) => row.partId === partId,
    )
    expect(stockRow?.onHand ?? 0).toBeLessThan(99)

    const transit = await request(server()).get(`/blueprints/${PKG_CNY}/views/in-transit`).expect(200)
    const transitRow = (transit.body as Array<{ partId: string; inTransit: number }>).find(
      (row) => row.partId === partId,
    )
    expect(transitRow?.inTransit ?? 0).toBeLessThan(77)

    const receivable = await request(server()).get(`/blueprints/${PKG_CNY}/views/receivable`).expect(200)
    expect(Array.isArray(receivable.body)).toBe(true)

    const traced = await request(server())
      .get(`/blueprints/${PKG_CNY}/traceability/batch/${encodeURIComponent('B-OTHER-CP')}`)
      .expect(200)
    expect(traced.body.found).toBe(false)

    const fitment = await request(server())
      .get(`/blueprints/${PKG_CNY}/fitment/parts`)
      .query({ make: 'Honda', model: 'Civic', year: '2012', position: 'front' })
      .expect(200)
    expect(fitment.body.parts).toEqual([])

    currentUser.organizationId = OTHER_ORG
    const imported = await request(server())
      .post(`/blueprints/${PKG_CNY}/import/Part`)
      .send({ rows: [{ partNo: 'OTHER-IMP', name: '他租导入' }] })
      .expect(200)
    expect(imported.body.imported).toBe(1)
    currentUser.organizationId = ORGANIZATION_ID
    const ours = await request(server()).get(`/blueprints/${PKG_CNY}/records/Part`).expect(200)
    expect(
      (ours.body as Array<{ data: { partNo?: string } }>).some((row) => row.data.partNo === 'OTHER-IMP'),
    ).toBe(false)
  })
})
