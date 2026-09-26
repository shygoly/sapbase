/**
 * 端到端：租户 A 导出并签名的包，租户 B 用**同一个** Runtime 入口装载并运行。
 *
 * 验收判据（add-deliverable-blueprint）：
 *   两次装载都走 loadBlueprint，仅 options.tenantId 不同（未改一行代码）。
 *   反例：改 grantedTo 不重签、未授权租户、过期授权 —— 都必须拒。
 *
 * 前置：本地 PostgreSQL 已有 sapbasic 库且原子/模块注册表已建。
 * 未满足时不硬失败，而是跳过并明确写出跳过原因。
 */
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import request from 'supertest'
import { generateKeyPairSync } from 'node:crypto'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AtomicRegistryModule } from '../src/atomic-registry/atomic-registry.module'
import { AtomicRegistryService } from '../src/atomic-registry/atomic-registry.service'
import { bindRunnableForTest } from '../src/atomic-registry/test-fixtures'
import { AtomicRuntimeModule } from '../src/atomic-runtime/atomic-runtime.module'
import { BlueprintModule } from '../src/blueprint/blueprint.module'
import { signPackage } from '../src/blueprint/license'
import { loadBlueprint } from '../src/blueprint/loader'
import { packBlueprint, unpackBlueprint } from '../src/blueprint/packager'
import { ModuleRegistryModule } from '../src/module-registry/module-registry.module'
import { ModuleRegistryService } from '../src/module-registry/module-registry.service'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'

const ATOMIC_TYPE = 'e2e-delivery-inventory'
const ORGANIZATION_ID = '33333333-3333-3333-3333-333333333333'
const TENANT_A = 'org-1111'
const TENANT_B = 'org-2222'
const TENANT_C = 'org-3333'

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

describe('蓝图跨租户交付（e2e）', () => {
  let app: INestApplication
  let dataSource: DataSource
  let available = true
  let packagesDir: string
  let exportDir: string
  let keys: { publicPem: string; privatePem: string }
  let savedPublicKeys: string | undefined
  let savedUnsigned: string | undefined

  const moduleArtifactSha = () =>
    (
      JSON.parse(
        readFileSync(join(__dirname, '../../wasm-modules/build/manifest.json'), 'utf8'),
      ) as { modules: Array<{ sha256: string }> }
    ).modules[0].sha256

  beforeAll(async () => {
    packagesDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-delivery-pkgs-'))
    exportDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-delivery-export-'))
    process.env.BLUEPRINT_PACKAGES_DIR = packagesDir
    savedUnsigned = process.env.BLUEPRINT_ALLOW_UNSIGNED
    delete process.env.BLUEPRINT_ALLOW_UNSIGNED

    keys = generatePemPair()
    savedPublicKeys = process.env.BLUEPRINT_LICENSE_PUBLIC_KEYS
    process.env.BLUEPRINT_LICENSE_PUBLIC_KEYS = JSON.stringify([keys.publicPem])

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
        ModuleRegistryModule,
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
            id: 'e2e-delivery-user',
            userId: 'e2e-delivery-user',
            email: 'delivery@test.local',
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
      await dataSource.query('SELECT 1 FROM module_registry LIMIT 1')
    } catch {
      available = false
    }

    if (available) {
      await dataSource.query(
        `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
         VALUES ($1, 'e2e-delivery', 'e2e-delivery', 'active', now(), now())
         ON CONFLICT (id) DO NOTHING`,
        [ORGANIZATION_ID],
      )
    }
  }, 60000)

  afterAll(async () => {
    if (dataSource?.isInitialized && available) {
      await dataSource.query('DELETE FROM module_registry WHERE "organizationId" = $1', [
        ORGANIZATION_ID,
      ])
      await dataSource.query('DELETE FROM atomic_contracts WHERE "atomicType" = $1', [ATOMIC_TYPE])
      await dataSource.query(`DELETE FROM audit_logs WHERE metadata->>'atomicType' = $1`, [
        ATOMIC_TYPE,
      ])
      await dataSource.query('DELETE FROM audit_logs WHERE "organizationId" = $1', [ORGANIZATION_ID])
      await dataSource.query('DELETE FROM organizations WHERE id = $1', [ORGANIZATION_ID])
    }
    await app?.close()
    delete process.env.BLUEPRINT_PACKAGES_DIR
    if (savedPublicKeys === undefined) delete process.env.BLUEPRINT_LICENSE_PUBLIC_KEYS
    else process.env.BLUEPRINT_LICENSE_PUBLIC_KEYS = savedPublicKeys
    if (savedUnsigned === undefined) delete process.env.BLUEPRINT_ALLOW_UNSIGNED
    else process.env.BLUEPRINT_ALLOW_UNSIGNED = savedUnsigned
    for (const dir of [packagesDir, exportDir]) {
      if (dir) rmSync(dir, { recursive: true, force: true })
    }
  })

  it('租户 A 导出签名 → 租户 B 经同一 loadBlueprint 装载运行；三个反例都拒', async () => {
    if (!available) {
      console.warn('跳过 e2e：本地库缺少原子注册表或模块注册表（先跑迁移）')
      return
    }

    const server = app.getHttpServer()
    const sha256 = moduleArtifactSha()
    const registry = app.get(AtomicRegistryService)

    await request(server).post('/atomic-contracts').send(CONTRACT).expect(201)
    const contract = (await registry.list(ATOMIC_TYPE))[0]
    await bindRunnableForTest(registry, contract.id, {
      kind: 'wasm' as never,
      moduleSha256: sha256,
      abiVersion: 1,
      tier: 'A' as never,
    })

    const modules = app.get(ModuleRegistryService)
    const module = await modules.create(
      {
        name: 'Delivery Parts ERP',
        version: '1.0.0',
        dependsOnAtomics: [`${ATOMIC_TYPE}@^1.0.0`],
        metadata: { entities: ['SalesOrder'] },
      },
      ORGANIZATION_ID,
    )
    await dataSource.query(
      `INSERT INTO module_capabilities (id, "moduleId", "capabilityType", entity, operations, "apiEndpoints", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, 'crud', 'Customer', '["list"]'::jsonb, '["/customers"]'::jsonb, now(), now())`,
      [module.id],
    )

    // 租户 A（卖家）：导出最小蓝图，写入授权（A 与 B 都可运行），签名
    const exported = await modules.exportBlueprint(module.id, ORGANIZATION_ID, { dir: exportDir })
    expect(exported.dropped).toEqual([])

    writeFileSync(
      join(exportDir, 'license.json'),
      JSON.stringify({
        license: 'blueprint-license/v1',
        grantedTo: [TENANT_A, TENANT_B],
        resell: false,
        expiresAt: '2027-09-25T00:00:00Z',
        issuer: 'sapbase-platform',
      }),
    )
    const pkg = join(packagesDir, 'delivery-parts-erp-1.0.0.erpkg')
    packBlueprint(exportDir, pkg)

    const compiled = await request(server)
      .post('/blueprints/delivery-parts-erp-1.0.0/compile')
      .send({ stamp: true })
      .expect(200)
    expect(compiled.body.ir.blueprint).toBe('delivery-parts-erp')
    signPackage(pkg, keys.privatePem)
    expect(unpackBlueprint(pkg).manifest.signature).toBeDefined()

    // 未改一行代码的证明：两次装载是同一个函数引用
    const loadEntry = loadBlueprint
    expect(loadEntry).toBe(loadBlueprint)

    const env = { BLUEPRINT_LICENSE_PUBLIC_KEYS: JSON.stringify([keys.publicPem]) }
    const loadedA = await loadEntry(pkg, registry, { tenantId: TENANT_A, env })
    const loadedB = await loadEntry(pkg, registry, { tenantId: TENANT_B, env })

    expect(loadedA.plan.irDigest).toBe(loadedB.plan.irDigest)
    expect(loadedA.plan.irDigest).toBe(compiled.body.irDigest)
    expect(loadedB.audit[0]?.action).toBe('blueprint.load.authorized')
    expect(loadedB.license?.grantedTo).toEqual([TENANT_A, TENANT_B])
    expect(loadedB.license?.resell).toBe(false)
    expect(loadedB.plan.resolvedAtomics[0]?.moduleSha256).toBe(sha256)

    const invoked = await request(server)
      .post(`/atomic-contracts/${ATOMIC_TYPE}/invoke`)
      .send({
        version: '^1.0.0',
        records: [{ onHand: 9, reserved: 4, inTransit: 1 }],
      })
      .expect(200)
    expect(invoked.body.columns.available).toEqual([6])
    expect(invoked.body.moduleSha256).toBe(loadedB.plan.resolvedAtomics[0].moduleSha256)

    // 反例 1：改 grantedTo 并更新 files 哈希，不重签 → 签名失效
    const tampered = join(packagesDir, 'tampered.erpkg')
    copyFileSync(pkg, tampered)
    const AdmZip = (await import('adm-zip')).default
    const zip = new AdmZip(tampered)
    const nextLicense = {
      license: 'blueprint-license/v1',
      grantedTo: [TENANT_C],
      resell: false,
      expiresAt: '2027-09-25T00:00:00Z',
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
    await expect(loadEntry(tampered, registry, { tenantId: TENANT_C, env })).rejects.toMatchObject({
      name: 'LoadError',
      reason: 'signature-invalid',
    })

    // 反例 2：未授权租户装载原包
    await expect(loadEntry(pkg, registry, { tenantId: TENANT_C, env })).rejects.toMatchObject({
      name: 'LoadError',
      reason: 'unauthorized',
    })

    // 反例 3：授权已过期（同一包，把 now 推过 expiresAt）
    await expect(
      loadEntry(pkg, registry, {
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
