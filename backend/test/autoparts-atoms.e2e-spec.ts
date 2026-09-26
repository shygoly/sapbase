/**
 * 端到端：经真实 HTTP 登记 5 个汽配原子并按 spec 判据 invoke。
 *
 * 契约正文来自 `autoparts-contracts.ts`（唯一真源），实现用闸 4 补录绑到
 * 清单里的入库 Wasm。本文件覆盖数值正例、每个原子一条错误码负例、缺权限 403。
 */
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import request from 'supertest'
import { join } from 'node:path'
import { AtomicRegistryModule } from '../src/atomic-registry/atomic-registry.module'
import { AtomicRegistryService } from '../src/atomic-registry/atomic-registry.service'
import { bindRunnableForTest } from '../src/atomic-registry/test-fixtures'
import { AtomicRuntimeModule } from '../src/atomic-runtime/atomic-runtime.module'
import {
  AUTOPARTS_ATOMIC_TYPES,
  AUTOPARTS_CONTRACTS,
  AUTOPARTS_PERMISSIONS,
  contractPayload,
  defaultAutopartsBuildDir,
  readAutopartsManifest,
} from '../src/atomic-runtime/autoparts-contracts'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'

const ORGANIZATION_ID = '55555555-5555-5555-5555-555555555555'
const ALL_PERMISSIONS = Object.values(AUTOPARTS_PERMISSIONS)

describe('汽配原子（e2e，真实 HTTP + 真实 Wasm）', () => {
  let app: INestApplication
  let dataSource: DataSource
  let available = true
  let grantedPermissions: string[] = [...ALL_PERMISSIONS]
  const sha256ByType = readAutopartsManifest(defaultAutopartsBuildDir())

  beforeAll(async () => {
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
            id: 'e2e-autoparts',
            userId: 'e2e-autoparts',
            email: 'autoparts-e2e@test.local',
            organizationId: ORGANIZATION_ID,
            permissions: grantedPermissions,
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
    } catch {
      available = false
    }

    if (available) {
      await dataSource.query(
        `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
         VALUES ($1, 'e2e-autoparts-atoms', 'e2e-autoparts-atoms', 'active', now(), now())
         ON CONFLICT (id) DO NOTHING`,
        [ORGANIZATION_ID],
      )
      await dataSource.query(
        `DELETE FROM atomic_contracts WHERE "atomicType" = ANY($1)`,
        [AUTOPARTS_ATOMIC_TYPES],
      )
      await dataSource.query(
        `DELETE FROM audit_logs WHERE metadata->>'atomicType' = ANY($1)`,
        [AUTOPARTS_ATOMIC_TYPES],
      )

      const server = app.getHttpServer()
      const registry = app.get(AtomicRegistryService)
      for (const def of AUTOPARTS_CONTRACTS) {
        await request(server).post('/atomic-contracts').send(contractPayload(def)).expect(201)
        const contract = (await registry.list(def.atomicType))[0]
        await bindRunnableForTest(registry, contract.id, {
          kind: 'wasm' as never,
          moduleSha256: sha256ByType[def.atomicType].sha256,
          abiVersion: 1,
          tier: 'A' as never,
        })
      }
    }
  }, 60000)

  afterAll(async () => {
    if (dataSource?.isInitialized && available) {
      await dataSource.query(
        `DELETE FROM atomic_contracts WHERE "atomicType" = ANY($1)`,
        [AUTOPARTS_ATOMIC_TYPES],
      )
      await dataSource.query(
        `DELETE FROM audit_logs WHERE metadata->>'atomicType' = ANY($1)`,
        [AUTOPARTS_ATOMIC_TYPES],
      )
      await dataSource.query('DELETE FROM organizations WHERE id = $1', [
        ORGANIZATION_ID,
      ])
    }
    await app?.close()
  })

  function invoke(atomicType: string, records: Array<Record<string, number>>) {
    return request(app.getHttpServer())
      .post(`/atomic-contracts/${atomicType}/invoke`)
      .send({ version: '^1.0.0', records })
  }

  it('ATP：X=8、Y=3（方向单向）、(10,3,0,2)→9', async () => {
    if (!available) {
      console.warn('跳过 e2e：本地库缺少原子注册表')
      return
    }
    const merged = await invoke('autoparts-atp', [
      { onHand: 5, reserved: 0, committed: 0, inTransit: 0, replacedBy: -1 },
      { onHand: 3, reserved: 0, committed: 0, inTransit: 0, replacedBy: 0 },
    ]).expect(200)
    expect(merged.body.total).toBe(8)
    expect(merged.body.columns.counted).toEqual([1, 1])
    expect(merged.body.moduleSha256).toBe(sha256ByType['autoparts-atp'].sha256)

    const onlyY = await invoke('autoparts-atp', [
      { onHand: 3, reserved: 0, committed: 0, inTransit: 0, replacedBy: -1 },
    ]).expect(200)
    expect(onlyY.body.total).toBe(3)

    const reserved = await invoke('autoparts-atp', [
      { onHand: 10, reserved: 3, committed: 0, inTransit: 2, replacedBy: -1 },
    ]).expect(200)
    expect(reserved.body.total).toBe(9)
  }, 60000)

  it('ATP 负例：成环 → 422 ATOMIC_FAILED', async () => {
    if (!available) return
    const response = await invoke('autoparts-atp', [
      { onHand: 1, reserved: 0, committed: 0, inTransit: 0, replacedBy: 1 },
      { onHand: 1, reserved: 0, committed: 0, inTransit: 0, replacedBy: 0 },
    ]).expect(422)
    expect(response.body.code).toBe('ATOMIC_FAILED')
    expect(response.body.message).toContain('（2）')
  })

  it('UoM：2.5 箱 → 精确 30（整数标度 3）', async () => {
    if (!available) return
    const response = await invoke('autoparts-uom-convert', [
      { qtyMinor: 2500, numerator: 12, denominator: 1, rounding: 0 },
    ]).expect(200)
    expect(response.body.columns.convertedMinor).toEqual([30000])
    expect(response.body.total).toBe(30000)
  })

  it('UoM 负例：不整除 → 422', async () => {
    if (!available) return
    const response = await invoke('autoparts-uom-convert', [
      { qtyMinor: 5, numerator: 1, denominator: 2, rounding: 0 },
    ]).expect(422)
    expect(response.body.code).toBe('ATOMIC_FAILED')
    expect(response.body.message).toContain('（3）')
  })

  it('Price：命中 A 级价（带 kind 依据）；无特定价 → 标准价', async () => {
    if (!available) return
    const grade = await invoke('autoparts-price', [
      { kind: 0, minQty: 0, priceMinor: 8800 },
      { kind: 3, minQty: 0, priceMinor: 10000 },
    ]).expect(200)
    expect(grade.body.total).toBe(8800)
    expect(grade.body.columns.selected).toEqual([1, 0])
    expect(grade.body.columns.kind).toEqual([0, 3])

    const standard = await invoke('autoparts-price', [
      { kind: 3, minQty: 0, priceMinor: 10000 },
    ]).expect(200)
    expect(standard.body.total).toBe(10000)
    expect(standard.body.columns.kind).toEqual([3])
  })

  it('Price 负例：缺标准价 / 非法 kind', async () => {
    if (!available) return
    const missing = await invoke('autoparts-price', [
      { kind: 0, minQty: 0, priceMinor: 8800 },
    ]).expect(422)
    expect(missing.body.message).toContain('（5）')
    const badKind = await invoke('autoparts-price', [
      { kind: 9, minQty: 0, priceMinor: 1 },
      { kind: 3, minQty: 0, priceMinor: 2 },
    ]).expect(422)
    expect(badKind.body.message).toContain('（6）')
  })

  it('Credit：超限 + 依据三项', async () => {
    if (!available) return
    const response = await invoke('autoparts-credit', [
      {
        limitMinor: 100000,
        receivableMinor: 90000,
        inFlightMinor: 0,
        orderMinor: 20000,
      },
    ]).expect(200)
    expect(response.body.columns.overLimit).toEqual([1])
    expect(response.body.columns.limitMinor).toEqual([100000])
    expect(response.body.columns.receivableMinor).toEqual([90000])
    expect(response.body.columns.orderMinor).toEqual([20000])
    expect(response.body.columns.availableMinor).toEqual([10000])
    expect(response.body.total).toBe(10000)
  })

  it('Credit 负例：负数入参 → 422', async () => {
    if (!available) return
    const response = await invoke('autoparts-credit', [
      {
        limitMinor: 100,
        receivableMinor: -1,
        inFlightMinor: 0,
        orderMinor: 0,
      },
    ]).expect(422)
    expect(response.body.message).toContain('（7）')
  })

  it('Supersession：旧→新方向 + canonical 合并计数', async () => {
    if (!available) return
    const response = await invoke('autoparts-supersession', [
      { replacedBy: -1 },
      { replacedBy: 0 },
    ]).expect(200)
    expect(response.body.columns.canonical).toEqual([0, 0])
    expect(response.body.columns.depth).toEqual([0, 1])
    expect(response.body.total).toBe(1)
  })

  it('Supersession 负例：成环 → 422', async () => {
    if (!available) return
    const response = await invoke('autoparts-supersession', [
      { replacedBy: 1 },
      { replacedBy: 0 },
    ]).expect(422)
    expect(response.body.message).toContain('（2）')
  })

  it('缺权限点 → 403 且审计留痕', async () => {
    if (!available) return
    grantedPermissions = []
    const response = await invoke('autoparts-credit', [
      {
        limitMinor: 100000,
        receivableMinor: 0,
        inFlightMinor: 0,
        orderMinor: 1,
      },
    ]).expect(403)
    expect(response.body.code).toBe('PERMISSION_DENIED')
    expect(response.body.message).toContain(AUTOPARTS_PERMISSIONS.credit)

    const logs = await dataSource.query(
      `SELECT status, metadata FROM audit_logs
        WHERE action = 'atomic.invoke' AND metadata->>'atomicType' = $1
        ORDER BY "createdAt" DESC LIMIT 1`,
      ['autoparts-credit'],
    )
    expect(logs[0].status).toBe('failure')
    grantedPermissions = [...ALL_PERMISSIONS]
  })
})
