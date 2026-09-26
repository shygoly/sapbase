/**
 * 端到端：租户 A 用最小汽配模板 deliver → 租户 B 装载 → 写入链 + 原子调用。
 *
 * 验收判据（add-minimal-autoparts-template）：
 *   合法 SalesOrder 写入成功并可读回；
 *   缺 partNo / quantity=0 / 未知字段 各被拦一次且不落库；
 *   调 available-inventory 断言数值与绑定哈希；
 *   前一变更的三个反例（未授权 / 篡改 / 过期）仍拒。
 *
 * 前置：本地 PostgreSQL 已有 sapbasic。缺表时 beforeAll 用同一份 DDL 幂等建表。
 * 未满足时不硬失败，而是跳过并明确写出跳过原因。
 */
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import request from 'supertest'
import { generateKeyPairSync } from 'node:crypto'
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { AtomicRegistryModule } from '../src/atomic-registry/atomic-registry.module'
import { AtomicRegistryService } from '../src/atomic-registry/atomic-registry.service'
import { bindRunnableForTest } from '../src/atomic-registry/test-fixtures'
import { AtomicRuntimeModule } from '../src/atomic-runtime/atomic-runtime.module'
import { BlueprintModule } from '../src/blueprint/blueprint.module'
import { loadBlueprint } from '../src/blueprint/loader'
import { unpackBlueprint } from '../src/blueprint/packager'
import { SemanticRuntimeModule } from '../src/semantic-runtime/semantic-runtime.module'
import { BLUEPRINT_RECORDS_DDL } from '../src/semantic-runtime/blueprint-record.ddl'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'

const ATOMIC_TYPE = 'available-inventory'
const ORGANIZATION_ID = '44444444-4444-4444-4444-444444444444'
const TENANT_B = ORGANIZATION_ID
const TENANT_C = '55555555-5555-5555-5555-555555555555'
const PACKAGE_ID = 'auto-parts-min-1.0.0'
const TEMPLATES_DIR = resolve(__dirname, '../../templates')

const CONTRACT = {
  atomicType: ATOMIC_TYPE,
  version: '1.0.0',
  kind: 'calculation',
  status: 'active',
  inputSchema: {
    rows: { source: '$lines', max: 100 },
    columns: [
      { name: 'onHand', source: '$line.onHand', type: 'i32' },
      { name: 'reserved', source: '$line.reserved', type: 'i32' },
      { name: 'inTransit', source: '$line.inTransit', type: 'i32' },
    ],
  },
  outputSchema: {
    columns: [{ name: 'available', type: 'i32' }],
    total: { name: 'totalAvailable' },
    maxOutputBytes: 65536,
  },
}

function generatePemPair(): { publicPem: string; privatePem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }
}

describe('最小汽配模板交付（e2e）', () => {
  let app: INestApplication
  let dataSource: DataSource
  let available = true
  let packagesDir: string
  let keys: { publicPem: string; privatePem: string }
  let savedPublicKeys: string | undefined
  let savedPrivateKey: string | undefined
  let savedUnsigned: string | undefined
  let savedTemplates: string | undefined

  const moduleArtifactSha = () =>
    (
      JSON.parse(
        readFileSync(join(__dirname, '../../wasm-modules/build/manifest.json'), 'utf8'),
      ) as { modules: Array<{ sha256: string }> }
    ).modules[0].sha256

  beforeAll(async () => {
    packagesDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-template-pkgs-'))
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
          switchToHttp: () => {
            getRequest: () => { user?: Record<string, unknown> }
          }
        }) => {
          context.switchToHttp().getRequest().user = {
            id: 'e2e-template-user',
            userId: 'e2e-template-user',
            email: 'template@test.local',
            organizationId: ORGANIZATION_ID,
          }
          return true
        },
      })
      .compile()

    app = moduleRef.createNestApplication()
    await app.init()
    dataSource = moduleRef.get(DataSource)

    try {
      await dataSource.query('SELECT 1 FROM atomic_contracts LIMIT 1')
      for (const statement of BLUEPRINT_RECORDS_DDL) {
        await dataSource.query(statement)
      }
    } catch (error) {
      available = false
      console.warn(`跳过 e2e：本地库不可用（${(error as Error).message}）`)
    }

    if (available) {
      await dataSource.query(
        `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
         VALUES ($1, 'e2e-template', 'e2e-template', 'active', now(), now())
         ON CONFLICT (id) DO NOTHING`,
        [ORGANIZATION_ID],
      )
    }
  }, 60000)

  afterAll(async () => {
    if (dataSource?.isInitialized && available) {
      await dataSource.query(
        `DELETE FROM blueprint_records WHERE "organizationId" = $1`,
        [ORGANIZATION_ID],
      )
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

  it('deliver → 租户 B 写入合法订单；三类非法写入各拦一次且不落库；原子数值与哈希；三反例仍拒', async () => {
    if (!available) {
      console.warn('跳过 e2e：本地库缺少原子注册表或无法建 blueprint_records')
      return
    }

    const server = app.getHttpServer()
    const sha256 = moduleArtifactSha()
    const registry = app.get(AtomicRegistryService)

    try {
      await registry.resolve(ATOMIC_TYPE, '^1.0.0')
    } catch {
      let contract = (await registry.list(ATOMIC_TYPE))[0]
      if (!contract) {
        await request(server).post('/atomic-contracts').send(CONTRACT).expect(201)
        contract = (await registry.list(ATOMIC_TYPE))[0]
      }
      await bindRunnableForTest(registry, contract.id, {
        kind: 'wasm' as never,
        moduleSha256: sha256,
        abiVersion: 1,
        tier: 'A' as never,
      })
    }

    const delivered = await request(server)
      .post('/blueprints/auto-parts-min/deliver')
      .send({
        grantedTo: [TENANT_B],
        resell: false,
        expiresAt: '2027-09-25T00:00:00Z',
        issuer: 'sapbase-platform',
      })
      .expect(200)
    expect(delivered.body.id).toBe(PACKAGE_ID)
    expect(delivered.body.manifest.compiled.irDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(delivered.body.manifest.signature).toBeDefined()

    await request(server).post(`/blueprints/${PACKAGE_ID}/load`).expect(200)

    const part = await request(server)
      .post(`/blueprints/${PACKAGE_ID}/records/Part`)
      .send({ partNo: 'P-100', name: '刹车片', unitCost: 12.5 })
      .expect(201)
    const customer = await request(server)
      .post(`/blueprints/${PACKAGE_ID}/records/Customer`)
      .send({ name: '华南汽修', creditLimit: 50000 })
      .expect(201)

    const order = await request(server)
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder`)
      .send({
        quantity: 3,
        unitPrice: 20,
        customer: customer.body.id,
        part: part.body.id,
      })
      .expect(201)
    expect(order.body.data.quantity).toBe(3)

    const listed = await request(server).get(`/blueprints/${PACKAGE_ID}/records/SalesOrder`).expect(200)
    expect(listed.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: order.body.id })]),
    )

    const partsBefore = await request(server).get(`/blueprints/${PACKAGE_ID}/records/Part`).expect(200)
    const partCount = partsBefore.body.length

    const missingPartNo = await request(server)
      .post(`/blueprints/${PACKAGE_ID}/records/Part`)
      .send({ name: '缺号物料' })
      .expect(400)
    expect(missingPartNo.body.reason).toBe('validation-failed')
    expect(missingPartNo.body.ruleId).toBe('part-no-required')

    const zeroQty = await request(server)
      .post(`/blueprints/${PACKAGE_ID}/records/SalesOrder`)
      .send({
        quantity: 0,
        unitPrice: 20,
        customer: customer.body.id,
        part: part.body.id,
      })
      .expect(400)
    expect(zeroQty.body.reason).toBe('validation-failed')
    expect(zeroQty.body.ruleId).toBe('so-qty-positive')

    const unknownField = await request(server)
      .post(`/blueprints/${PACKAGE_ID}/records/Part`)
      .send({ partNo: 'P-ghost', ghost: true })
      .expect(400)
    expect(unknownField.body.reason).toBe('unknown-field')

    const partsAfter = await request(server).get(`/blueprints/${PACKAGE_ID}/records/Part`).expect(200)
    expect(partsAfter.body.length).toBe(partCount)
    const ordersAfter = await request(server).get(`/blueprints/${PACKAGE_ID}/records/SalesOrder`).expect(200)
    expect(ordersAfter.body.length).toBe(1)

    const invoked = await request(server)
      .post(`/atomic-contracts/${ATOMIC_TYPE}/invoke`)
      .send({
        version: '^1.0.0',
        records: [{ onHand: 9, reserved: 4, inTransit: 1 }],
      })
      .expect(200)
    expect(invoked.body.columns.available).toEqual([6])
    const loadedB = await loadBlueprint(join(packagesDir, `${PACKAGE_ID}.erpkg`), registry, {
      tenantId: TENANT_B,
      env: { BLUEPRINT_LICENSE_PUBLIC_KEYS: JSON.stringify([keys.publicPem]) },
    })
    expect(invoked.body.moduleSha256).toBe(loadedB.plan.resolvedAtomics[0].moduleSha256)
    expect(loadedB.plan.resolvedAtomics[0].moduleSha256).toBe(sha256)

    const pkg = join(packagesDir, `${PACKAGE_ID}.erpkg`)
    const env = { BLUEPRINT_LICENSE_PUBLIC_KEYS: JSON.stringify([keys.publicPem]) }

    await expect(loadBlueprint(pkg, registry, { tenantId: TENANT_C, env })).rejects.toMatchObject({
      name: 'LoadError',
      reason: 'unauthorized',
    })

    const tampered = join(packagesDir, 'tampered.erpkg')
    copyFileSync(pkg, tampered)
    const AdmZip = (await import('adm-zip')).default
    const zip = new AdmZip(tampered)
    const nextLicense = {
      license: 'blueprint-license/v1',
      grantedTo: [TENANT_C],
      resell: false,
      issuer: 'sapbase-platform',
    }
    zip.updateFile('license.json', Buffer.from(JSON.stringify(nextLicense)))
    const manifestEntry = zip.getEntry('manifest.json')
    if (!manifestEntry) throw new Error('测试夹具损坏：缺 manifest.json')
    const manifest = JSON.parse(manifestEntry.getData().toString()) as {
      files: Record<string, string>
    }
    const { createHash } = await import('node:crypto')
    manifest.files['license.json'] =
      `sha256:${createHash('sha256').update(JSON.stringify(nextLicense)).digest('hex')}`
    zip.updateFile('manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`))
    zip.writeZip(tampered)
    await expect(loadBlueprint(tampered, registry, { tenantId: TENANT_C, env })).rejects.toMatchObject({
      name: 'LoadError',
      reason: 'signature-invalid',
    })
    expect(unpackBlueprint(pkg).manifest.signature).toBeDefined()

    await expect(
      loadBlueprint(pkg, registry, {
        tenantId: TENANT_B,
        now: new Date('2028-01-01T00:00:00Z'),
        env,
      }),
    ).rejects.toMatchObject({
      name: 'LoadError',
      reason: 'license-expired',
    })
  }, 60000)
})
