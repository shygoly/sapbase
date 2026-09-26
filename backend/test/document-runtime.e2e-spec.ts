/**
 * P1 单据运行时验收：头行回滚 / 并发不重号 / 单号 23505 兜底 /
 * 非法迁移拒 + 审计 / 分页排序 / 未声明过滤字段拒 / 删除被引用拒 /
 * 查询两种响应形状。
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

const ORGANIZATION_ID = '66666666-6666-6666-6666-666666666666'
const PACKAGE_ID = 'auto-parts-1.1.0'
const TEMPLATES_DIR = resolve(__dirname, '../../templates')

function generatePemPair(): { publicPem: string; privatePem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }
}

describe('单据运行时（P1 e2e）', () => {
  // 本套里有"30 次顺序 HTTP 写入再分页"这类用例：默认 5s 在 CI 负载下会**超时假红**
  // （jest-e2e.json 没有 setup 文件，故默认超时是 5s 而不是 test/setup.ts 里的 30s）。
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
    packagesDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-doc-pkgs-'))
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
            id: 'e2e-doc-user',
            userId: 'e2e-doc-user',
            email: 'doc@test.local',
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

    await dataSource.query(
      `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
       VALUES ($1, 'e2e-document', 'e2e-document', 'active', now(), now())
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
      .send({ partNo: 'P-DOC-1', name: '刹车片', unitCost: 12.5, packSize: 12 })
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
      await dataSource.query(`DELETE FROM blueprint_records WHERE "organizationId" = $1`, [
        ORGANIZATION_ID,
      ])
      await dataSource.query(`DELETE FROM blueprint_approvals WHERE "organizationId" = $1`, [
        ORGANIZATION_ID,
      ]).catch(() => undefined)
      await dataSource.query(`DELETE FROM blueprint_journal_entries WHERE "organizationId" = $1`, [
        ORGANIZATION_ID,
      ]).catch(() => undefined)
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

  function line(quantity: number) {
    return { quantity, unitPrice: 20, part: partId }
  }

  it('行失败则整单回滚：头不在库', async () => {
    if (!available) return
    const before = await request(server()).get(`/blueprints/${PACKAGE_ID}/records/SalesOrder`).expect(200)
    const count = before.body.length
    const failed = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder`)
      .send({
        customer: customerId,
        quantity: 3,
        children: { SalesOrderLine: [line(1), { ...line(0) }] },
      })
      .expect(400)
    expect(failed.body.reason).toBe('validation-failed')
    const after = await request(server()).get(`/blueprints/${PACKAGE_ID}/records/SalesOrder`).expect(200)
    expect(after.body.length).toBe(count)
    const lines = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/records/SalesOrderLine`)
      .expect(200)
    expect(Array.isArray(lines.body)).toBe(true)
  })

  it('成功提交后头行可一起读回；无查询参数仍是裸数组', async () => {
    if (!available) return
    const created = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder`)
      .send({
        customer: customerId,
        quantity: 3,
        children: { SalesOrderLine: [line(1), line(2)] },
      })
      .expect(201)
    expect(created.body.data.number).toMatch(/^SO-\d{8}\d{4}$/)
    expect(created.body.state).toBe('draft')

    const listed = await request(server()).get(`/blueprints/${PACKAGE_ID}/records/SalesOrder`).expect(200)
    expect(Array.isArray(listed.body)).toBe(true)
    expect(listed.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.body.id })]),
    )

    const lines = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/records/SalesOrderLine`)
      .expect(200)
    const mine = lines.body.filter((row: { data: { order?: string } }) => row.data.order === created.body.id)
    expect(mine).toHaveLength(2)
  })

  it('并发建单不重号（N≥8）', async () => {
    if (!available) return
    const posts = Array.from({ length: 8 }, () =>
      request(server())
        .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder`)
        .send({
          customer: customerId,
          quantity: 1,
          children: { SalesOrderLine: [line(1)] },
        }),
    )
    const results = await Promise.all(posts)
    for (const result of results) {
      expect(result.status).toBe(201)
    }
    const numbers = results.map((result) => result.body.data.number as string)
    expect(new Set(numbers).size).toBe(8)
  })

  it('单号 23505 兜底：预植下一号后重试拿到不同号', async () => {
    if (!available) return
    const first = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder`)
      .send({ customer: customerId, quantity: 1, children: { SalesOrderLine: [line(1)] } })
      .expect(201)
    const current = first.body.data.number as string
    const prefix = current.slice(0, -4)
    const nextSeq = Number(current.slice(-4)) + 1
    const planted = `${prefix}${String(nextSeq).padStart(4, '0')}`
    await dataSource.query(
      `INSERT INTO public.blueprint_records
        (id, "createdAt", "updatedAt", "organizationId", "blueprintId", "blueprintVersion", entity, data, state, version)
       VALUES ($1, now(), now(), $2, 'auto-parts', '1.0.0', 'SalesOrder', $3::jsonb, 'draft', 1)`,
      [
        randomUUID(),
        ORGANIZATION_ID,
        JSON.stringify({ customer: customerId, quantity: 1, number: planted }),
      ],
    )

    const second = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder`)
      .send({ customer: customerId, quantity: 1, children: { SalesOrderLine: [line(1)] } })
      .expect(201)
    expect(second.body.data.number).not.toBe(planted)
    expect(second.body.data.number).not.toBe(current)
  })

  it('合法迁移 + 审计；非法迁移拒且 state 仍是 draft', async () => {
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
    expect(illegal.body.message).toMatch(/draft → shipped/)
    expect(illegal.body.message).toMatch(/confirmed/)

    const still = await dataSource.query(
      `SELECT state FROM public.blueprint_records WHERE id = $1`,
      [created.body.id],
    )
    expect(still[0].state).toBe('draft')

    const ok = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder/${created.body.id}/transition`)
      .send({ to: 'confirmed' })
      .expect(200)
    expect(ok.body.state).toBe('confirmed')

    const audits = (await dataSource.query(
      `SELECT actor, action, resource, "resourceId", changes
         FROM public.audit_logs
        WHERE "organizationId" = $1 AND "resourceId" = $2 AND action = 'blueprint.record.transition'`,
      [ORGANIZATION_ID, created.body.id],
    )) as Array<{ actor: string; changes: { from: string; to: string } }>
    expect(audits.length).toBeGreaterThanOrEqual(1)
    expect(audits[0].actor).toBe('e2e-doc-user')
    expect(audits[0].changes).toMatchObject({ from: 'draft', to: 'confirmed' })
  })

  it('分页与排序：第 2 页返回第 11–20 条且顺序正确；信封形状', async () => {
    if (!available) return
    for (let i = 1; i <= 30; i += 1) {
      await request(server())
        .post(`/blueprints/${PACKAGE_ID}/records/Part`)
        .send({
          partNo: `Q-${String(i).padStart(2, '0')}`,
          name: `件${i}`,
          packSize: 1,
        })
        .expect(201)
    }
    const page = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/records/Part`)
      .query({ page: '2', pageSize: '10', sort: 'partNo', order: 'desc' })
      .expect(200)
    expect(Array.isArray(page.body)).toBe(false)
    expect(page.body.total).toBeGreaterThanOrEqual(31)
    expect(page.body.page).toBe(2)
    expect(page.body.pageSize).toBe(10)
    expect(page.body.items).toHaveLength(10)
    const numbers = page.body.items.map((row: { data: { partNo: string } }) => row.data.partNo)
    expect(numbers).toEqual([
      'Q-20',
      'Q-19',
      'Q-18',
      'Q-17',
      'Q-16',
      'Q-15',
      'Q-14',
      'Q-13',
      'Q-12',
      'Q-11',
    ])
  })

  it('未声明的过滤字段被拒并指明；无查询参数仍是裸数组', async () => {
    if (!available) return
    const raw = await request(server()).get(`/blueprints/${PACKAGE_ID}/records/Customer`).expect(200)
    expect(Array.isArray(raw.body)).toBe(true)

    const denied = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/records/Customer`)
      .query({ filter: JSON.stringify({ foo: '1' }) })
      .expect(400)
    expect(denied.body.reason).toBe('unknown-field')
    expect(denied.body.message).toMatch(/foo/)
    expect(denied.body.message).toMatch(/未被.*声明/)
  })

  it('删除被引用的零件 → 拒并列出引用实例', async () => {
    if (!available) return
    const part = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/Part`)
      .send({ partNo: 'P-DEL-1', name: '被引用件', packSize: 1 })
      .expect(201)
    const order = await request(server())
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder`)
      .send({
        customer: customerId,
        quantity: 1,
        children: {
          SalesOrderLine: [{ quantity: 1, unitPrice: 20, part: part.body.id }],
        },
      })
      .expect(201)

    const denied = await request(server())
      .delete(`/blueprints/${PACKAGE_ID}/records/Part/${part.body.id}`)
      .expect(400)
    expect(denied.body.reason).toBe('referenced')
    expect(denied.body.message).toMatch(/SalesOrderLine/)

    const still = await dataSource.query(`SELECT id FROM public.blueprint_records WHERE id = $1`, [
      part.body.id,
    ])
    expect(still).toHaveLength(1)

    const lines = await request(server())
      .get(`/blueprints/${PACKAGE_ID}/records/SalesOrderLine`)
      .expect(200)
    expect(lines.body.some((row: { data: { order?: string } }) => row.data.order === order.body.id)).toBe(
      true,
    )
  })
})
