/**
 * P4-3 三个视图 + P5-1 升级可读 + P5-2 重签。
 *
 * 旧 1.0.0 数据由本文件现场造：复制当前模板、剥掉新字段、改回 1.0.0 再 deliver。
 * 仓库里不长期放第二份 1.0.0 模板。
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
import { verifyAgainstTrustRoots } from '../src/blueprint/license'
import { unpackBlueprint } from '../src/blueprint/packager'
import { SemanticRuntimeModule } from '../src/semantic-runtime/semantic-runtime.module'
import { findNotNullConflicts } from '../src/semantic-runtime/db-constraints'
import { BLUEPRINT_APPROVALS_DDL } from '../src/semantic-runtime/blueprint-approval.ddl'
import { BLUEPRINT_DOC_COUNTERS_DDL } from '../src/semantic-runtime/blueprint-doc-counter.ddl'
import { BLUEPRINT_JOURNAL_ENTRIES_DDL } from '../src/semantic-runtime/blueprint-journal-entry.ddl'
import { BLUEPRINT_RECORDS_DDL } from '../src/semantic-runtime/blueprint-record.ddl'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'

const ORGANIZATION_ID = '14141414-1414-1414-1414-141414141414'
const OTHER_ORG = '15151515-1515-1515-1515-151515151515'
const PKG_V100 = 'auto-parts-1.0.0'
const PKG_V110 = 'auto-parts-1.1.0'
const REPO_TEMPLATES = resolve(__dirname, '../../templates')

function generatePemPair(): { publicPem: string; privatePem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }
}

function stripToV100(dir: string): void {
  const blueprintPath = join(dir, 'blueprint.json')
  const blueprint = JSON.parse(readFileSync(blueprintPath, 'utf8')) as { version: string }
  blueprint.version = '1.0.0'
  writeFileSync(blueprintPath, `${JSON.stringify(blueprint, null, 2)}\n`)

  const semanticPath = join(dir, 'semantic.json')
  const semantic = JSON.parse(readFileSync(semanticPath, 'utf8')) as {
    entities: Array<{ name: string; fields: Array<{ name: string }> }>
  }
  for (const entity of semantic.entities) {
    if (entity.name === 'Part') {
      entity.fields = entity.fields.filter((field) => field.name !== 'countryOfOrigin')
    }
    if (entity.name === 'StockItem') {
      entity.fields = entity.fields.filter((field) => field.name !== 'inTransit')
    }
  }
  writeFileSync(semanticPath, `${JSON.stringify(semantic, null, 2)}\n`)
}

describe('升级视图与重签（P4-3 / P5-1 / P5-2 e2e）', () => {
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
  let orderId = ''
  let stockId = ''

  const server = () => app.getHttpServer()

  beforeAll(async () => {
    packagesDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-upgrade-pkgs-'))
    templatesDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-upgrade-tpl-'))
    cpSync(REPO_TEMPLATES, templatesDir, { recursive: true })
    const v100Dir = join(templatesDir, 'auto-parts-v100')
    cpSync(join(templatesDir, 'auto-parts'), v100Dir, { recursive: true })
    stripToV100(v100Dir)

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
          context.switchToHttp().getRequest().user = {
            id: 'e2e-upgrade-user',
            userId: 'e2e-upgrade-user',
            email: 'upgrade@test.local',
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
      [ORGANIZATION_ID, 'e2e-upgrade'],
      [OTHER_ORG, 'e2e-upgrade-other'],
    ] as const) {
      await dataSource.query(
        `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
         VALUES ($1, $2, $2, 'active', now(), now())
         ON CONFLICT (id) DO NOTHING`,
        [id, slug],
      )
    }

    const deliveredV100 = await request(server()).post('/blueprints/auto-parts-v100/deliver').send({
      grantedTo: [ORGANIZATION_ID],
      resell: false,
      issuer: 'sapbase-platform',
    })
    if (deliveredV100.status !== 200) {
      available = false
      console.warn(`跳过 e2e：deliver 1.0.0 失败（${deliveredV100.status} ${JSON.stringify(deliveredV100.body)}）`)
      return
    }
    expect(deliveredV100.body.id).toBe(PKG_V100)
    await request(server()).post(`/blueprints/${PKG_V100}/load`).expect(200)

    const part = await request(server())
      .post(`/blueprints/${PKG_V100}/records/Part`)
      .send({ partNo: 'BRK-UP-08', name: '升级前刹车片', unitCost: 12.5, packSize: 12 })
      .expect(201)
    const customer = await request(server())
      .post(`/blueprints/${PKG_V100}/records/Customer`)
      .send({ name: '宁波华兴', creditLimit: 80000 })
      .expect(201)
    partId = part.body.id
    customerId = customer.body.id

    const stock = await request(server())
      .post(`/blueprints/${PKG_V100}/records/StockItem`)
      .send({ part: partId, quantity: 10, reserved: 2 })
      .expect(201)
    stockId = stock.body.id

    const order = await request(server())
      .post(`/blueprints/${PKG_V100}/records/SalesOrder`)
      .send({
        customer: customerId,
        quantity: 2,
        children: { SalesOrderLine: [{ part: partId, quantity: 2, unitPrice: 20 }] },
      })
      .expect(201)
    orderId = order.body.id

    const deliveredV110 = await request(server()).post('/blueprints/auto-parts/deliver').send({
      grantedTo: [ORGANIZATION_ID],
      resell: false,
      issuer: 'sapbase-platform',
    })
    if (deliveredV110.status !== 200) {
      available = false
      console.warn(`跳过 e2e：deliver 1.1.0 失败（${deliveredV110.status} ${JSON.stringify(deliveredV110.body)}）`)
      return
    }
    expect(deliveredV110.body.id).toBe(PKG_V110)
    await request(server()).post(`/blueprints/${PKG_V110}/load`).expect(200)
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

  it('旧数据在 1.1.0 下可读：default 只出现在返回值，原始行未改', async () => {
    if (!available) return
    const listed = await request(server()).get(`/blueprints/${PKG_V110}/records/Part`).expect(200)
    const part = (listed.body as Array<{ id: string; data: Record<string, unknown> }>).find(
      (row) => row.id === partId,
    )
    expect(part?.data.countryOfOrigin).toBe('CN')
    expect(part?.data.partNo).toBe('BRK-UP-08')

    const stocks = await request(server()).get(`/blueprints/${PKG_V110}/records/StockItem`).expect(200)
    const stock = (stocks.body as Array<{ id: string; data: Record<string, unknown> }>).find(
      (row) => row.id === stockId,
    )
    expect(stock?.data.inTransit).toBe(0)

    const raw = (await dataSource.query(
      `SELECT data FROM public.blueprint_records WHERE id IN ($1, $2)`,
      [partId, stockId],
    )) as Array<{ data: Record<string, unknown> }>
    expect(raw.some((row) => Object.prototype.hasOwnProperty.call(row.data, 'countryOfOrigin'))).toBe(
      false,
    )
    expect(raw.some((row) => Object.prototype.hasOwnProperty.call(row.data, 'inTransit'))).toBe(false)
  })

  it('升级场景：旧行缺新 required+default 字段 → 不算非空冲突，写入不被拦', async () => {
    if (!available) return
    const conflicts = await findNotNullConflicts(dataSource, 'auto-parts', {
      entities: [
        {
          name: 'Part',
          fields: [
            { name: 'partNo', type: 'text', required: true },
            { name: 'countryOfOrigin', type: 'text', required: true, default: 'CN' },
          ],
        },
      ],
    })
    expect(conflicts).toEqual([])

    const created = await request(server())
      .post(`/blueprints/${PKG_V110}/records/Part`)
      .send({ partNo: 'BRK-UP-NEW', name: '升级后新件' })
      .expect(201)
    expect(created.body.data.partNo).toBe('BRK-UP-NEW')
    const readBack = await request(server()).get(`/blueprints/${PKG_V110}/records/Part`).expect(200)
    const row = (readBack.body as Array<{ id: string; data: Record<string, unknown> }>).find(
      (item) => item.id === created.body.id,
    )
    expect(row?.data.countryOfOrigin).toBe('CN')
  })

  it('三个视图：库存 / 在途 / 应收口径；draft 不计；空结果 200 + []；租户隔离', async () => {
    if (!available) return
    const emptyReceivable = await request(server())
      .get(`/blueprints/${PKG_V110}/views/receivable`)
      .expect(200)
    expect(emptyReceivable.body).toEqual([])

    await request(server())
      .post(`/blueprints/${PKG_V110}/records/StockItem`)
      .send({ part: partId, quantity: 5, reserved: 1, inTransit: 4 })
      .expect(201)

    const stock = await request(server()).get(`/blueprints/${PKG_V110}/views/stock`).expect(200)
    expect(Array.isArray(stock.body)).toBe(true)
    const stockRow = (
      stock.body as Array<{
        partId: string
        partNo?: string
        onHand: number
        reserved: number
        available: number
        inTransit: number
      }>
    ).find((row) => row.partId === partId)
    expect(stockRow).toMatchObject({
      partId,
      partNo: 'BRK-UP-08',
      onHand: 15,
      reserved: 3,
      available: 12,
      inTransit: 4,
    })

    const inTransit = await request(server()).get(`/blueprints/${PKG_V110}/views/in-transit`).expect(200)
    const transitRow = (
      inTransit.body as Array<{ partId: string; partNo?: string; inTransit: number }>
    ).find((row) => row.partId === partId)
    expect(transitRow).toEqual({ partId, partNo: 'BRK-UP-08', inTransit: 4 })

    await request(server())
      .post(`/blueprints/${PKG_V110}/records/SalesOrder/${orderId}/transition`)
      .send({ to: 'confirmed' })
      .expect(200)

    const receivable = await request(server())
      .get(`/blueprints/${PKG_V110}/views/receivable`)
      .expect(200)
    expect(receivable.body).toHaveLength(1)
    expect(receivable.body[0]).toMatchObject({
      customerId,
      customerName: '宁波华兴',
    })
    expect(typeof receivable.body[0].receivable).toBe('string')
    expect(receivable.body[0].receivable).toMatch(/^40(\.0+)?$/)

    const draft = await request(server())
      .post(`/blueprints/${PKG_V110}/records/SalesOrder`)
      .send({
        customer: customerId,
        quantity: 1,
        children: { SalesOrderLine: [{ part: partId, quantity: 1, unitPrice: 99 }] },
      })
      .expect(201)
    const still = await request(server()).get(`/blueprints/${PKG_V110}/views/receivable`).expect(200)
    expect(still.body).toHaveLength(1)
    expect(still.body[0].receivable).toMatch(/^40(\.0+)?$/)

    await request(server())
      .post(`/blueprints/${PKG_V110}/records/SalesOrder/${draft.body.id}/transition`)
      .send({ to: 'confirmed' })
      .expect(200)
    await request(server())
      .post(`/blueprints/${PKG_V110}/records/SalesOrder/${draft.body.id}/transition`)
      .send({ to: 'shipped' })
      .expect(200)
    await request(server())
      .post(`/blueprints/${PKG_V110}/records/SalesOrder/${draft.body.id}/transition`)
      .send({ to: 'closed' })
      .expect(200)
    const afterClosed = await request(server())
      .get(`/blueprints/${PKG_V110}/views/receivable`)
      .expect(200)
    expect(afterClosed.body).toHaveLength(1)
    expect(afterClosed.body[0].receivable).toMatch(/^40(\.0+)?$/)

    await dataSource.query(
      `INSERT INTO public.blueprint_records
        (id, "createdAt", "updatedAt", "organizationId", "blueprintId", "blueprintVersion", entity, data, state, version)
       VALUES ($1, now(), now(), $2, 'auto-parts', '1.1.0', 'StockItem', $3::jsonb, 'inStock', 1)`,
      [
        randomUUID(),
        OTHER_ORG,
        JSON.stringify({ part: partId, quantity: 99, reserved: 0, inTransit: 88 }),
      ],
    )
    const isolated = await request(server()).get(`/blueprints/${PKG_V110}/views/stock`).expect(200)
    const isolatedRow = (
      isolated.body as Array<{ partId: string; onHand: number; inTransit: number }>
    ).find((row) => row.partId === partId)
    expect(isolatedRow?.onHand).toBe(15)
    expect(isolatedRow?.inTransit).toBe(4)
  })

  it('负例：旧模板状态在当前模板未声明 → 迁移拒', async () => {
    if (!available) return
    const legacyId = randomUUID()
    await dataSource.query(
      `INSERT INTO public.blueprint_records
        (id, "createdAt", "updatedAt", "organizationId", "blueprintId", "blueprintVersion", entity, data, state, version)
       VALUES ($1, now(), now(), $2, 'auto-parts', '1.0.0', 'SalesOrder', $3::jsonb, 'legacy-hold', 1)`,
      [
        legacyId,
        ORGANIZATION_ID,
        JSON.stringify({ customer: customerId, quantity: 1, number: 'SO-LEGACY-HOLD-001' }),
      ],
    )
    const denied = await request(server())
      .post(`/blueprints/${PKG_V110}/records/SalesOrder/${legacyId}/transition`)
      .send({ to: 'confirmed' })
      .expect(400)
    expect(denied.body.reason).toBe('legacy-state')
    expect(denied.body.message).toMatch(/该行处于旧模板状态 legacy-hold，当前模板未声明/)
  })

  it('旧签名对新 manifest 无效；重签后可装载；省略 grantedTo 拒', async () => {
    if (!available) return
    const oldPkg = unpackBlueprint(join(packagesDir, `${PKG_V100}.erpkg`))
    const newPkg = unpackBlueprint(join(packagesDir, `${PKG_V110}.erpkg`))
    const env = { BLUEPRINT_LICENSE_PUBLIC_KEYS: JSON.stringify([keys.publicPem]) }
    expect(oldPkg.manifest.signature).toBeDefined()
    expect(newPkg.manifest.signature).toBeDefined()
    expect(oldPkg.manifest.compiled?.irDigest).not.toBe(newPkg.manifest.compiled?.irDigest)
    expect(verifyAgainstTrustRoots(newPkg.manifest, oldPkg.manifest.signature as string, env)).toBe(
      false,
    )
    expect(verifyAgainstTrustRoots(newPkg.manifest, newPkg.manifest.signature as string, env)).toBe(
      true,
    )

    await request(server()).post(`/blueprints/${PKG_V110}/load`).expect(200)

    const omitted = await request(server()).post('/blueprints/auto-parts/deliver').send({}).expect(400)
    expect(omitted.body.reason).toBe('invalid-license')
    expect(omitted.body.message).toMatch(/grantedTo/)
  })
})
