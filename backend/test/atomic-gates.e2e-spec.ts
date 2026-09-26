/**
 * 端到端：**闸 3（输出管控）与闸 4（影子发布）经真实 HTTP 生效**。
 *
 * 三件事必须能在这个文件里看到：
 *   1. 一个**真的在泄漏**的模块（`wasm-modules/modules/leaky-output-bits-rust`）
 *      经 HTTP 调用被闸 3 拦下，返回 422 并带上判据编号，且**没有结果返回**
 *   2. 一条实现按 `submitted → built → tested → shadow → canary → active` 逐级带证据
 *      走到 `active`（每一步的证据都由 HTTP 端点记录），晋升后才可执行
 *   3. 绕过影子期直接跳级（bind 成 active / 从 tested 直接 active）被拒
 *
 * 前置：本地 PostgreSQL 已有 `sapbasic` 库且原子注册表已建
 * （`npx ts-node --transpile-only scripts/run-targeted-migration.ts --group=atomic`）。
 */
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { TypeOrmModule } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import request from 'supertest'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { AtomicRegistryModule } from '../src/atomic-registry/atomic-registry.module'
import { AtomicRegistryService } from '../src/atomic-registry/atomic-registry.service'
import { AtomicRuntimeModule } from '../src/atomic-runtime/atomic-runtime.module'
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard'

const ORGANIZATION_ID = '33333333-3333-3333-3333-333333333333'
const LEAKY_TYPE = 'e2e-gate-leaky'
const ORDER_TYPE = 'e2e-gate-order'
const HONEST_TYPE = 'e2e-gate-honest'

const MODULES_DIR = join(__dirname, '../../wasm-modules/build')

/** 真实模块产物的哈希（按字节自算，不采信任何清单）。 */
function sha256OfFile(file: string): string {
  return createHash('sha256').update(readFileSync(join(MODULES_DIR, file))).digest('hex')
}

/** 泄漏夹具的产物：在 build/ 里按文件名找（它刻意不在生产准入清单里）。 */
function leakySha256(atomicType: string): string {
  const file = readdirSync(MODULES_DIR).find(
    (f) => f.startsWith(`${atomicType}-`) && f.endsWith('.wasm'),
  )
  if (!file) throw new Error(`build/ 里没有夹具产物：${atomicType}`)
  return sha256OfFile(file)
}

function honestSha256(): string {
  const manifest = JSON.parse(readFileSync(join(MODULES_DIR, 'manifest.json'), 'utf8')) as {
    modules: Array<{ atomicType: string; file: string }>
  }
  const entry = manifest.modules.find((m) => m.atomicType === 'available-inventory')
  if (!entry) throw new Error('清单里没有 available-inventory')
  return sha256OfFile(entry.file)
}

/** 与 available-inventory 的 ABI 同形；`maximum` 是本用例的判据前提。 */
function contract(atomicType: string) {
  return {
    atomicType,
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
      columns: [{ name: 'available', type: 'i32', minimum: 0, maximum: 1000000 }],
      total: { name: 'totalAvailable' },
      maxOutputBytes: 65536,
    },
  }
}

describe('原子闸门（e2e，真实 HTTP + 真实 Wasm）', () => {
  let app: INestApplication
  let dataSource: DataSource
  let available = true

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
      // 闸 3 / 闸 4 的列必须都在
      await dataSource.query('SELECT "outputAudit" FROM atomic_contracts LIMIT 1')
      await dataSource.query('SELECT "releaseEvidence" FROM atomic_implementations LIMIT 1')
    } catch {
      available = false
    }

    if (available) {
      await dataSource.query(
        `INSERT INTO organizations (id, name, slug, "subscriptionStatus", "createdAt", "updatedAt")
         VALUES ($1, 'e2e-gates', 'e2e-gates', 'active', now(), now())
         ON CONFLICT (id) DO NOTHING`,
        [ORGANIZATION_ID],
      )
    }
  }, 60000)

  afterAll(async () => {
    if (dataSource?.isInitialized && available) {
      await dataSource.query('DELETE FROM atomic_contracts WHERE "atomicType" = ANY($1)', [
        [LEAKY_TYPE, ORDER_TYPE, HONEST_TYPE],
      ])
      await dataSource.query(
        `DELETE FROM audit_logs WHERE metadata->>'atomicType' = ANY($1)`,
        [[LEAKY_TYPE, ORDER_TYPE, HONEST_TYPE]],
      )
      await dataSource.query('DELETE FROM organizations WHERE id = $1', [ORGANIZATION_ID])
    }
    await app?.close()
  })

  it('闸 3：泄漏模块经 HTTP 调用被拦下（422 + 判据编号 + 无结果）', async () => {
    if (!available) {
      console.warn('跳过 e2e：本地库缺少原子注册表或闸 3/4 的列（先跑定向迁移）')
      return
    }
    if (!existsSync(MODULES_DIR)) {
      console.warn('跳过 e2e：缺少 wasm-modules/build')
      return
    }
    const server = app.getHttpServer()
    const registry = app.get(AtomicRegistryService)

    const created = await request(server)
      .post('/atomic-contracts')
      .send(contract(LEAKY_TYPE))
      .expect(201)
    expect(created.body.outputAudit).toBe('standard')

    // 绑定走 HTTP（闸 4 只允许从 submitted 起步），再显式补录到可运行 ——
    // 本用例的对象是**闸 3**，不是晋升链（晋升链由下一个用例走完整）
    const bound = await request(server)
      .post(`/atomic-contracts/${created.body.id}/implementations`)
      .send({
        kind: 'wasm',
        moduleSha256: leakySha256('leaky-output-bits'),
        abiVersion: 1,
        tier: 'A',
      })
      .expect(201)
    expect(bound.body.status).toBe('submitted')
    await registry.grandfatherImplementation(bound.body.id, {
      reason: 'e2e：本用例验证闸 3，准入链由另一用例覆盖',
      decidedBy: 'e2e-atomic-gates',
    })

    const invoked = await request(server)
      .post(`/atomic-contracts/${LEAKY_TYPE}/invoke`)
      .send({
        version: '^1.0.0',
        records: [
          { onHand: 10, reserved: 4, inTransit: 1 },
          { onHand: 105, reserved: 5, inTransit: 0 },
        ],
      })
      .expect(422)

    expect(invoked.body.code).toBe('OUTPUT_OUT_OF_RANGE')
    expect(invoked.body.protocolCode).toBe('atomic.output.O2')
    expect(invoked.body.message).toContain('1000000')
    // **没有结果返回** —— 命中判决即拒绝，不是"警告后放行"
    expect(invoked.body.columns).toBeUndefined()
    expect(invoked.body.total).toBeUndefined()

    // 失败也留痕，且留痕里能看到是闸 3 的哪一条拦的
    const logs = await dataSource.query(
      `SELECT status, metadata FROM audit_logs
        WHERE action = 'atomic.invoke' AND metadata->>'atomicType' = $1`,
      [LEAKY_TYPE],
    )
    expect(logs).toHaveLength(1)
    expect(logs[0].status).toBe('failure')
    expect(logs[0].metadata.reason).toContain('atomic.output.O2')
  }, 60000)

  it('闸 4：逐级带证据走到 active，之后调用成功且审计带闸 3 报告', async () => {
    if (!available) return
    const server = app.getHttpServer()

    const created = await request(server)
      .post('/atomic-contracts')
      .send(contract(HONEST_TYPE))
      .expect(201)
    const contractId = created.body.id as string

    // 1) 绑定只能落在 submitted
    const bound = await request(server)
      .post(`/atomic-contracts/${contractId}/implementations`)
      .send({
        kind: 'wasm',
        moduleSha256: honestSha256(),
        abiVersion: 1,
        tier: 'A',
        sourceGate: { language: 'rust', checks: ['no-build-rs'] },
        staticGate: { checks: ['import=env.memory(min=2,max=1024)'] },
        reproducibleBuildRef: 'repro:rust:1.95.0:e2e',
        status: 'active', // ← 想直接落在 active：必须被拒
      })
      .expect(400)
    expect(bound.body.message).toContain('TRANSITION_NOT_ALLOWED')

    // 2) 老老实实从 submitted 起步
    const impl = await request(server)
      .post(`/atomic-contracts/${contractId}/implementations`)
      .send({ kind: 'wasm', moduleSha256: honestSha256(), abiVersion: 1, tier: 'A' })
      .expect(201)
    expect(impl.body.status).toBe('submitted')
    const implId = impl.body.id as string

    // 3) 跳级：submitted → active 被拒
    const skip = await request(server)
      .post(`/atomic-contracts/implementations/${implId}/promote`)
      .send({ to: 'active' })
      .expect(400)
    expect(skip.body.message).toContain('TRANSITION_NOT_ALLOWED')

    // 4) 缺证据：晋 built 被拒，且说明缺 sourceGate
    const noEvidence = await request(server)
      .post(`/atomic-contracts/implementations/${implId}/promote`)
      .send({ to: 'built' })
      .expect(400)
    expect(noEvidence.body.message).toContain('EVIDENCE_MISSING')
    expect(noEvidence.body.message).toContain('sourceGate')

    // 5) 逐级记录证据 → 晋升
    const steps: Array<[string, Record<string, unknown>]> = [
      ['built', { sourceGate: { language: 'rust', checks: ['no-build-rs'] } }],
      [
        'tested',
        {
          staticGate: { checks: ['import=env.memory(min=2,max=1024)'] },
          reproducibleBuildRef: 'repro:rust:1.95.0:e2e',
        },
      ],
      [
        'shadow',
        {
          shadow: {
            parallelWith: 'available-inventory@1.0.0',
            startedAt: '2026-09-25T00:00:00Z',
            observedInvocations: 1000,
            differingResults: 0,
          },
        },
      ],
      [
        'canary',
        {
          canary: {
            startedAt: '2026-09-25T01:00:00Z',
            observedInvocations: 5000,
            differingResults: 0,
          },
        },
      ],
    ]
    for (const [to, evidence] of steps) {
      await request(server)
        .post(`/atomic-contracts/implementations/${implId}/release-evidence`)
        .send(evidence)
        .expect(201)
      const promoted = await request(server)
        .post(`/atomic-contracts/implementations/${implId}/promote`)
        .send({ to })
        .expect(201)
      expect(promoted.body.status).toBe(to)
    }
    const active = await request(server)
      .post(`/atomic-contracts/implementations/${implId}/promote`)
      .send({ to: 'active' })
      .expect(201)
    expect(active.body.status).toBe('active')

    // 6) 走完影子期的实现可以执行，结果里带闸 3 报告（判了什么、没判什么）
    const invoked = await request(server)
      .post(`/atomic-contracts/${HONEST_TYPE}/invoke`)
      .send({
        version: '^1.0.0',
        records: [
          { onHand: 10, reserved: 4, inTransit: 1 },
          { onHand: 105, reserved: 5, inTransit: 0 },
        ],
      })
      .expect(200)
    expect(invoked.body.columns.available).toEqual([7, 100])
    expect(invoked.body.outputGate.verdicts.O4).toMatchObject({ judged: true, passed: true })
    expect(invoked.body.outputGate.verdicts.O5.judged).toBe(false)

    const logs = await dataSource.query(
      `SELECT metadata FROM audit_logs
        WHERE action = 'atomic.invoke' AND metadata->>'atomicType' = $1`,
      [HONEST_TYPE],
    )
    expect(logs[0].metadata.outputGate.profile).toBe('standard')
    expect(logs[0].metadata.outputGate.rounds).toBe(3)
  }, 60000)

  it('闸 3：输出随行序变化的模块经 HTTP 调用被 O4 拦下', async () => {
    if (!available) return
    const server = app.getHttpServer()
    const registry = app.get(AtomicRegistryService)

    const created = await request(server)
      .post('/atomic-contracts')
      .send(contract(ORDER_TYPE))
      .expect(201)
    const bound = await request(server)
      .post(`/atomic-contracts/${created.body.id}/implementations`)
      .send({
        kind: 'wasm',
        moduleSha256: leakySha256('leaky-order-channel'),
        abiVersion: 1,
        tier: 'A',
      })
      .expect(201)
    await registry.grandfatherImplementation(bound.body.id, {
      reason: 'e2e：本用例验证闸 3 的 O4，准入链由另一用例覆盖',
      decidedBy: 'e2e-atomic-gates-order',
    })

    const invoked = await request(server)
      .post(`/atomic-contracts/${ORDER_TYPE}/invoke`)
      .send({
        version: '^1.0.0',
        records: [
          { onHand: 10, reserved: 4, inTransit: 1 },
          { onHand: 105, reserved: 5, inTransit: 0 },
        ],
      })
      .expect(422)

    // O4 不需要任何声明就能判 —— 这条判据的存在就是"不许用行序开隐蔽通道"
    expect(invoked.body.code).toBe('OUTPUT_BATCH_INCONSISTENT')
    expect(invoked.body.protocolCode).toBe('atomic.output.O4')
    expect(invoked.body.message).toContain('第 1 行')
    expect(invoked.body.columns).toBeUndefined()
  }, 60000)

  it('补录过的实现可查（隐形的例外才是真正危险的东西）', async () => {
    if (!available) return
    const server = app.getHttpServer()
    const response = await request(server)
      .get('/atomic-contracts/implementations/grandfathered')
      .expect(200)
    const ours = (response.body as Array<{ releaseEvidence: { grandfather: { decidedBy: string } } }>)
      .filter((entry) => entry.releaseEvidence?.grandfather?.decidedBy === 'e2e-atomic-gates')
    expect(ours).toHaveLength(1)
  })
})
