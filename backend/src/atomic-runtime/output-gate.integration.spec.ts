// 闸 3 接进执行链的证据：**真实泄漏模块**被拦下，**真实合规模块**照常通过。
//
// 夹具在 `wasm-modules/modules/leaky-*-rust`：它们能过闸 0/1/2（见
// `wasm-modules/scripts/leaky-fixtures.test.mjs`），所以这里是"闸 3 到底挡没挡住"
// 唯一能反驳/证实的地方 —— 光有闸的单元测试，证明不了它与执行链接上了。
import { existsSync, readFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { AtomicRegistryService } from '../atomic-registry/atomic-registry.service'
import { bindRunnableForTest } from '../atomic-registry/test-fixtures'
import { AtomicContractStatus } from '../atomic-registry/atomic-contract.entity'
import {
  AdmissionStatus,
  AtomicImplementationKind,
} from '../atomic-registry/atomic-implementation.entity'
import { AtomicExecutor } from './atomic-executor.service'
import { WasmModuleLoader } from './wasm-module-loader'
import { WasmModuleVerifier } from './wasm-module-verifier'
import { WasmInstancePool } from './wasm-instance-pool'
import { WasmtimeSidecarClient } from './wasmtime-sidecar.client'
import { type WasmEngine } from './wasm-engine'
import { AtomicRuntimeError } from './atomic-runtime.error'

const BUILD_DIR = resolve(__dirname, '../../../wasm-modules/build')
const MANIFEST = join(BUILD_DIR, 'manifest.json')
const SIDECAR_BINARY = resolve(__dirname, '../../../crates/wasm-host/target/release/wasm-host')

function join(dir: string, file: string): string {
  return resolve(dir, file)
}

const pools: WasmEngine[] = []

afterAll(async () => {
  for (const pool of pools) await pool.close?.()
})

function fakeRepo(seed: Record<string, unknown>[] = []) {
  const rows: Record<string, unknown>[] = [...seed]
  const match = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => row[k] === v)
  return {
    findOne: async ({ where }: { where: Record<string, unknown> }) =>
      rows.find((r) => match(r, where)) ?? null,
    find: async ({ where }: { where?: Record<string, unknown> } = {}) =>
      where ? rows.filter((r) => match(r, where)) : [...rows],
    create: (data: Record<string, unknown>) => ({ ...data }),
    save: async (entity: Record<string, unknown>) => {
      if (!entity.id) entity.id = `id-${rows.length + 1}`
      rows.push(entity)
      return entity
    },
  }
}

/** 与生产契约同形：输入三列、输出一列 + 汇总位。 */
function contractFor(overrides: Record<string, unknown> = {}) {
  return {
    atomicType: 'gate-under-test',
    version: '1.0.0',
    kind: 'calculation',
    status: AtomicContractStatus.ACTIVE,
    inputSchema: {
      rows: { source: '$lines', max: 1000 },
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
    ...overrides,
  }
}

function manifestEntry(atomicType: string) {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
    modules: Array<{ atomicType: string; sha256: string }>
  }
  const entry = manifest.modules.find((m) => m.atomicType === atomicType)
  if (!entry) throw new Error(`清单里没有模块：${atomicType}`)
  return entry
}

/**
 * 泄漏夹具的哈希：**按产物字节自己算**，不从清单读。
 *
 * 夹具的产物在 `build/`（loader 按哈希前缀找得到），但**不在** `build/manifest.json`
 * 里 —— 那是生产准入台账，已知做手脚的模块不该登记进去。
 */
function fixtureSha256(atomicType: string): string {
  const file = readdirSync(BUILD_DIR).find(
    (f) => f.startsWith(`${atomicType}-`) && f.endsWith('.wasm'),
  )
  if (!file) throw new Error(`build/ 里没有夹具产物：${atomicType}`)
  return createHash('sha256').update(readFileSync(join(BUILD_DIR, file))).digest('hex')
}

/** 用真实模块产物搭一条可执行链（引擎跟随 ATOMIC_ENGINE，默认 wasmtime）。 */
async function buildRuntime(boundAtomicType: string, contract?: Record<string, unknown>) {
  const registry = new AtomicRegistryService(
    fakeRepo() as never,
    fakeRepo() as never,
    fakeRepo() as never,
  )
  const saved = await registry.createContract(contract ?? contractFor())
  await bindRunnableForTest(registry, saved.id, {
    kind: AtomicImplementationKind.WASM,
    moduleSha256: boundAtomicType.startsWith('leaky-')
      ? fixtureSha256(boundAtomicType)
      : manifestEntry(boundAtomicType).sha256,
    abiVersion: 1,
    tier: 'A' as never,
  })

  const engineKind = (process.env.ATOMIC_ENGINE ?? 'wasmtime').toLowerCase()
  const pool: WasmEngine =
    engineKind === 'wasmtime' ? new WasmtimeSidecarClient(SIDECAR_BINARY) : new WasmInstancePool()
  pools.push(pool)

  const executor = new AtomicExecutor(
    registry,
    new WasmModuleLoader(BUILD_DIR),
    new WasmModuleVerifier(),
    pool,
  )
  return { executor }
}

const ROWS = [
  { onHand: 10, reserved: 4, inTransit: 1 },
  { onHand: 105, reserved: 5, inTransit: 0 },
]

describe('闸 3 在真实执行链上生效', () => {
  const ready = existsSync(MANIFEST)

  it('合规模块照常通过，报告里写清"判了什么、没判什么"', async () => {
    if (!ready) return
    const { executor } = await buildRuntime('available-inventory')
    const result = await executor.invoke({
      atomicType: 'gate-under-test',
      version: '^1.0.0',
      records: ROWS,
    })

    expect(result.columns.available).toEqual([7, 100])
    expect(result.total).toBe(107)
    expect(result.outputGate.profile).toBe('standard')
    expect(result.outputGate.verdicts.O2).toEqual({ judged: true, passed: true })
    expect(result.outputGate.verdicts.O4).toEqual({
      judged: true,
      passed: true,
      rowsJudged: 2,
    })
    // 未声明 commutative → O5 未判（如实写明原因，而不是默认通过）
    expect(result.outputGate.verdicts.O5).toEqual({
      judged: false,
      passed: false,
      reason: '契约未声明 commutative',
    })
    // 回合数：批量 1 + 逐行 2
    expect(result.outputGate.rounds).toBe(3)
  })

  it('夹具一（常量藏高位）→ O2 拦下，且不返回任何结果', async () => {
    if (!ready) return
    const { executor } = await buildRuntime('leaky-output-bits')

    await expect(
      executor.invoke({ atomicType: 'gate-under-test', version: '^1.0.0', records: ROWS }),
    ).rejects.toMatchObject({
      name: 'AtomicRuntimeError',
      code: 'OUTPUT_OUT_OF_RANGE',
      protocolCode: 'atomic.output.O2',
    })
  })

  it('夹具二（输出随行序变化）→ O4 拦下，且不返回任何结果', async () => {
    if (!ready) return
    const { executor } = await buildRuntime('leaky-order-channel')

    try {
      await executor.invoke({ atomicType: 'gate-under-test', version: '^1.0.0', records: ROWS })
      throw new Error('本应被闸 3 拦下')
    } catch (error) {
      expect(error).toBeInstanceOf(AtomicRuntimeError)
      expect((error as AtomicRuntimeError).protocolCode).toBe('atomic.output.O4')
      // 明细必须能说清"哪一行、批量是多少、单独算是多少"
      expect((error as Error).message).toContain('第 1 行')
      expect((error as Error).message).toContain('批量算')
    }
  })

  it('夹具二若声明可交换 → O5 也判（但 O4 先命中，因为它不需要任何声明）', async () => {
    if (!ready) return
    const { executor } = await buildRuntime(
      'leaky-order-channel',
      contractFor({
        outputSchema: {
          ...contractFor().outputSchema,
          commutative: true,
        },
        outputAudit: 'strict',
      }),
    )

    try {
      await executor.invoke({ atomicType: 'gate-under-test', version: '^1.0.0', records: ROWS })
      throw new Error('本应被闸 3 拦下')
    } catch (error) {
      expect((error as AtomicRuntimeError).protocolCode).toBe('atomic.output.O4')
    }
  })

  it('档位 off → 不跑追加判据（回合数 1），O4/O5 记"未判"', async () => {
    if (!ready) return
    const { executor } = await buildRuntime(
      'available-inventory',
      contractFor({ outputAudit: 'off', outputAuditReason: '测试夹具：验证 off 档位的执行路径' }),
    )
    const result = await executor.invoke({
      atomicType: 'gate-under-test',
      version: '^1.0.0',
      records: ROWS,
    })
    expect(result.outputGate.rounds).toBe(1)
    expect(result.outputGate.verdicts.O4.judged).toBe(false)
    // 既有判据不受档位影响：值域与大小上限照判
    expect(result.outputGate.verdicts.O2.judged).toBe(true)
    expect(result.outputGate.verdicts.O3.judged).toBe(true)
  })
})
