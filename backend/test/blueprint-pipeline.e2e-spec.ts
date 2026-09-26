/**
 * 端到端：**真实模块 → 导出最小蓝图 → 打包 → 编译 → 加载 → 原子绑定 → 经 HTTP 调用该原子**。
 *
 * 这是本变更（add-blueprint-package-and-compiler）的收口用例：在此之前，
 * "模块"只是数据库里的一行 —— 不能导出、不能版本化、不能拿到别处重建；
 * "原子"虽已能执行，但没有东西把它绑进一个可交付的包。
 *
 * 前置：本地 PostgreSQL 已有 `sapbasic` 库且原子注册表与模块注册表已建。
 * 未满足时不硬失败，而是跳过并**明确写出跳过原因**。
 */
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import request from 'supertest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AtomicRegistryModule } from '../src/atomic-registry/atomic-registry.module'
import { AtomicRegistryService } from '../src/atomic-registry/atomic-registry.service'
import { bindRunnableForTest } from '../src/atomic-registry/test-fixtures'
import { AtomicRuntimeModule } from '../src/atomic-runtime/atomic-runtime.module'
import { BlueprintModule } from '../src/blueprint/blueprint.module'
import { ModuleRegistryModule } from '../src/module-registry/module-registry.module'
import { ModuleRegistryService } from '../src/module-registry/module-registry.service'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'

const ATOMIC_TYPE = 'e2e-blueprint-inventory'
const ORGANIZATION_ID = '22222222-2222-2222-2222-222222222222'

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

describe('蓝图管线（e2e，真实模块 + 真实 Wasm 原子）', () => {
  let app: INestApplication
  let dataSource: DataSource
  let available = true
  let packagesDir: string
  let exportDir: string
  let moduleId: string

  const moduleArtifactSha = () =>
    (
      JSON.parse(
        readFileSync(join(__dirname, '../../wasm-modules/build/manifest.json'), 'utf8'),
      ) as { modules: Array<{ sha256: string }> }
    ).modules[0].sha256

  beforeAll(async () => {
    packagesDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-pkgs-'))
    exportDir = mkdtempSync(join(tmpdir(), 'speckit-e2e-export-'))
    // 必须在 BlueprintService 实例化之前设置：它的包目录在构造时确定
    process.env.BLUEPRINT_PACKAGES_DIR = packagesDir
    // 本文件测管线（导出→编译→绑定），不是授权链；显式走开发豁免
    process.env.BLUEPRINT_ALLOW_UNSIGNED = '1'

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
            id: 'e2e-user',
            userId: 'e2e-user',
            email: 'e2e@test.local',
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
         VALUES ($1, 'e2e-blueprint', 'e2e-blueprint', 'active', now(), now())
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
    delete process.env.BLUEPRINT_ALLOW_UNSIGNED
    for (const dir of [packagesDir, exportDir]) {
      if (dir) rmSync(dir, { recursive: true, force: true })
    }
  })

  it('模块定义 → 蓝图包 → 编译 → 加载 → 原子绑定 → 经 HTTP 调用该原子', async () => {
    if (!available) {
      console.warn('跳过 e2e：本地库缺少原子注册表或模块注册表（先跑迁移）')
      return
    }

    const server = app.getHttpServer()
    const sha256 = moduleArtifactSha()

    // 1) 真实原子：登记契约（HTTP）+ 绑定真实产物
    await request(server).post('/atomic-contracts').send(CONTRACT).expect(201)
    const registry = app.get(AtomicRegistryService)
    const contract = (await registry.list(ATOMIC_TYPE))[0]
    await bindRunnableForTest(registry, contract.id, {
      kind: 'wasm' as never,
      moduleSha256: sha256,
      abiVersion: 1,
      tier: 'A' as never,
    })

    // 2) 真实模块：建记录（发布时按同一判据校验原子依赖）+ 挂 capability
    const modules = app.get(ModuleRegistryService)
    const module = await modules.create(
      {
        name: 'Auto Parts ERP',
        version: '1.0.0',
        dependsOnAtomics: [`${ATOMIC_TYPE}@^1.0.0`],
        metadata: { entities: ['SalesOrder'] },
      },
      ORGANIZATION_ID,
    )
    moduleId = module.id
    // capability 直接落库：`ModuleRegistryService.addCapability` 会走 `findOne()`，
    // 而那条查询连 `createdBy` 一起 JOIN `users`。本地库的 `users` 是早期形态
    // （`roleId` / `departmentId`），而 `User` 实体声明的 `role` / `department` /
    // `permissions` 在库里不存在（根因：仓库迁移集没有 `users` 基线），
    // 于是直接报 `column ... role does not exist`。
    // 那是**既有缺口**（本次 e2e 顺手发现，已记录，另立变更修），
    // 与蓝图管线无关，所以这里用 SQL 造这一行数据，不把无关的失败掩进来。
    await dataSource.query(
      `INSERT INTO module_capabilities (id, "moduleId", "capabilityType", entity, operations, "apiEndpoints", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, 'crud', 'Customer', '["list"]'::jsonb, '["/customers"]'::jsonb, now(), now())`,
      [module.id],
    )

    // 3) 导出最小蓝图（骨架 → 目录 → .erpkg）
    const exported = await modules.exportBlueprint(module.id, ORGANIZATION_ID, {
      dir: exportDir,
    })
    expect(exported.dropped).toEqual([])
    expect(exported.manifest.blueprint).toBe('auto-parts-erp')
    expect(exported.manifest.dependencies).toEqual([
      { atomic: ATOMIC_TYPE, version: '^1.0.0' },
    ])

    // 骨架内容：实体名取自模块记录，字段/生命周期不编造
    const semantic = JSON.parse(readFileSync(join(exportDir, 'semantic.json'), 'utf8')) as {
      entities: Array<{ name: string; fields: unknown[] }>
    }
    expect(semantic.entities.map((entity) => entity.name)).toEqual(['SalesOrder', 'Customer'])
    expect(semantic.entities.every((entity) => entity.fields.length === 0)).toBe(true)

    // 4) 编译（HTTP），并把 IR 摘要写回包内清单
    const blueprintId = 'auto-parts-erp-1.0.0'
    const compiled = await request(server)
      .post(`/blueprints/${blueprintId}/compile`)
      .send({ stamp: true })
      .expect(200)
    expect(compiled.body.ir.blueprint).toBe('auto-parts-erp')
    expect(compiled.body.ir.dependencies).toEqual([`${ATOMIC_TYPE}@1.0.0`])
    expect(compiled.body.stamped).toBe(true)

    const manifest = await request(server).get(`/blueprints/${blueprintId}/manifest`).expect(200)
    expect(manifest.body.compiled.irDigest).toBe(compiled.body.irDigest)

    // 5) 加载（HTTP）：原子绑定在加载期定下来
    const loaded = await request(server).post(`/blueprints/${blueprintId}/load`).expect(200)
    expect(loaded.body.plan.resolvedAtomics).toEqual([
      {
        atomic: ATOMIC_TYPE,
        requested: '^1.0.0',
        version: '1.0.0',
        implementationKind: 'wasm',
        moduleSha256: sha256,
        tier: 'A',
      },
    ])
    expect(loaded.body.plan.irDigest).toBe(compiled.body.irDigest)

    // 6) 经 HTTP 调用**计划里绑定的那个原子**：返回值里的 moduleSha256 与计划一致
    const invoked = await request(server)
      .post(`/atomic-contracts/${ATOMIC_TYPE}/invoke`)
      .send({
        version: '^1.0.0',
        records: [{ onHand: 9, reserved: 4, inTransit: 1 }],
      })
      .expect(200)
    expect(invoked.body.columns.available).toEqual([6])
    expect(invoked.body.moduleSha256).toBe(loaded.body.plan.resolvedAtomics[0].moduleSha256)
  }, 60000)

  it('把模块依赖换成一个不存在的原子版本 → 导出即拒（不交付编译必然失败的包）', async () => {
    if (!available) return
    const modules = app.get(ModuleRegistryService)

    // 直接改记录（绕过发布校验）来模拟"库里已经有一条坏依赖的模块"
    await dataSource.query(
      `UPDATE module_registry SET "dependsOnAtomics" = $1 WHERE id = $2`,
      [JSON.stringify([`${ATOMIC_TYPE}@^9.0.0`]), moduleId],
    )

    await expect(
      modules.exportBlueprint(moduleId, ORGANIZATION_ID, { dir: exportDir }),
    ).rejects.toThrow(/依赖的原子不可用/)
  })

  it('模块注册表的既有查询在真实库上可用（users 基线回归）', async () => {
    if (!available) return
    const modules = app.get(ModuleRegistryService)

    const module = await modules.create(
      { name: 'Baseline Probe', version: '1.0.0', metadata: { entities: ['Probe'] } },
      ORGANIZATION_ID,
    )

    // 这一条在补 users 基线之前是 500：findOne 会 JOIN createdBy，
    // 而 User 实体声明的 role / department / permissions 在早期库的 users 表里不存在。
    const found = await modules.findOne(module.id, ORGANIZATION_ID)
    expect(found.name).toBe('Baseline Probe')

    // capability 走同一条查询（也是之前挂掉的那条路）
    await expect(
      modules.addCapability(
        module.id,
        { capabilityType: 'crud' as never, entity: 'Probe', operations: [], apiEndpoints: [] },
        ORGANIZATION_ID,
      ),
    ).resolves.toBeDefined()

    await modules.remove(module.id, ORGANIZATION_ID)
  })
})
