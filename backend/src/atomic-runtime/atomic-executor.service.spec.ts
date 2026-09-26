// 宿主 Wasm 运行时 —— 真实模块的 ABI 往返 + 五类拒绝路径（backend/AGENTS.md：必须带负例）。
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { buildFixtureWasm } from '@speckit/wasm-modules'
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
const REAL_MANIFEST = join(BUILD_DIR, 'manifest.json')

/** 与 service.spec 同构的内存 Repository。 */
function fakeRepo(seed: Record<string, unknown>[] = []) {
  const rows: Record<string, unknown>[] = [...seed]
  const match = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => row[k] === v)
  return {
    rows,
    findOne: async ({ where }: { where: Record<string, unknown> }) =>
      rows.find((r) => match(r, where)) ?? null,
    find: async ({ where }: { where?: Record<string, unknown> } = {}) =>
      where ? rows.filter((r) => match(r, where)) : [...rows],
    create: (data: Record<string, unknown>) => ({ ...data }),
    save: async (entity: Record<string, unknown>) => {
      if (!entity.id) {
        entity.id = `id-${rows.length + 1}`
        rows.push(entity)
      }
      return entity
    },
  }
}

const AVAILABLE_INVENTORY_CONTRACT = {
  atomicType: 'available-inventory',
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
    columns: [{ name: 'available', type: 'i32' }],
    total: { name: 'totalAvailable' },
    maxOutputBytes: 65536,
  },
}

/**
 * 造一个**能通过闸 1 但永不返回**的模块：导入 env.memory、
 * 导出 run/abi_version，函数体是 `loop br 0` 死循环（末尾 unreachable 让类型检查成立）。
 */
function buildHangWasm(): Uint8Array {
  const uleb = (value: number): number[] => {
    const out: number[] = []
    let v = value >>> 0
    do {
      let byte = v & 0x7f
      v >>>= 7
      if (v !== 0) byte |= 0x80
      out.push(byte)
    } while (v !== 0)
    return out
  }
  const utf8 = (text: string): number[] => {
    const bytes = Array.from(new TextEncoder().encode(text))
    return [...uleb(bytes.length), ...bytes]
  }
  const vec = (items: number[][]): number[] => [...uleb(items.length), ...items.flat()]
  const section = (id: number, content: number[]): number[] => [
    id,
    ...uleb(content.length),
    ...content,
  ]

  const bytes: number[] = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]
  // type: (i32,i32,i32) -> i32
  bytes.push(...section(1, vec([[0x60, 0x03, 0x7f, 0x7f, 0x7f, 0x01, 0x7f]])))
  // import: env.memory min2 max1024
  bytes.push(
    ...section(
      2,
      vec([
        [
          ...utf8('env'),
          ...utf8('memory'),
          0x02,
          0x01,
          ...uleb(2),
          ...uleb(1024),
        ],
      ]),
    ),
  )
  bytes.push(...section(3, vec([[0x00]]))) // function
  bytes.push(...section(6, vec([[0x7f, 0x00, 0x41, 0x01, 0x0b]]))) // global abi_version = 1
  bytes.push(
    ...section(
      7,
      vec([
        [...utf8('run'), 0x00, ...uleb(0)],
        [...utf8('abi_version'), 0x03, ...uleb(0)],
      ]),
    ),
  )
  const body = [0x00, 0x03, 0x40, 0x0c, 0x00, 0x0b, 0x00, 0x0b] // locals; loop; br 0; end; unreachable; end
  bytes.push(...section(10, vec([[...uleb(body.length), ...body]])))
  return new Uint8Array(bytes)
}

/** 用真实模块产物搭一条可执行的注册表链。 */
async function buildRuntime(options: {
  modulesDir?: string
  sha256?: string
  contract?: Record<string, unknown>
  ledgerRows?: Record<string, unknown>[]
}) {
  const contracts = fakeRepo()
  const implementations = fakeRepo()
  const manifests = fakeRepo(options.ledgerRows ?? [])
  const registry = new AtomicRegistryService(
    contracts as never,
    implementations as never,
    manifests as never,
  )
  const savedContract = await registry.createContract(
    options.contract ?? AVAILABLE_INVENTORY_CONTRACT,
  )
  const sha256 =
    options.sha256 ??
    (JSON.parse(readFileSync(REAL_MANIFEST, 'utf8')).modules[0].sha256 as string)
  // 执行链用例：用闸 4 显式补录替代逐级晋升（准入路径另见 shadow-release.spec.ts）
  await bindRunnableForTest(registry, savedContract.id, {
    kind: AtomicImplementationKind.WASM,
    moduleSha256: sha256,
    abiVersion: 1,
    tier: 'A' as never,
  })

  const loader = new WasmModuleLoader(options.modulesDir ?? BUILD_DIR)
  const verifier = new WasmModuleVerifier()
  // 引擎由环境变量选择，默认值与生产一致（wasmtime）：
  // 同一批用例既能覆盖默认路径，也能用 ATOMIC_ENGINE=v8 做对拍。
  const engineKind = (process.env.ATOMIC_ENGINE ?? 'wasmtime').toLowerCase()
  const pool: WasmEngine =
    engineKind === 'wasmtime'
      ? new WasmtimeSidecarClient(SIDECAR_BINARY)
      : new WasmInstancePool()
  pools.push(pool)
  return {
    registry,
    loader,
    pool,
    executor: new AtomicExecutor(registry, loader, verifier, pool),
  }
}

/** sidecar 二进制（`ATOMIC_ENGINE=wasmtime` 时使用）。 */
const SIDECAR_BINARY = resolve(
  __dirname,
  '../../../crates/wasm-host/target/release/wasm-host',
)

/** 常驻引擎需要在测试收尾时关闭，否则 jest 会报未释放句柄。 */
const pools: WasmEngine[] = []

afterAll(async () => {
  await Promise.all(pools.map((pool) => pool.close()))
})

describe('AtomicExecutor.invoke（真实模块 ABI 往返）', () => {
  it('可用库存 = 现有 - 预留 + 在途，且合计正确', async () => {
    if (!existsSync(REAL_MANIFEST)) return
    const { executor } = await buildRuntime({})

    const result = await executor.invoke({
      atomicType: 'available-inventory',
      version: '^1.0.0',
      records: [
        { onHand: 10, reserved: 4, inTransit: 1 },
        { onHand: 5, reserved: 0, inTransit: 2 },
      ],
    })

    expect(result.columns.available).toEqual([7, 7])
    expect(result.total).toBe(14)
    expect(result.rows).toBe(2)
    expect(result.moduleSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(result.gateChecks.length).toBeGreaterThan(0)
  })

  it('单行也能跑（n=1）', async () => {
    if (!existsSync(REAL_MANIFEST)) return
    const { executor } = await buildRuntime({})
    const result = await executor.invoke({
      atomicType: 'available-inventory',
      version: '^1.0.0',
      records: [{ onHand: 0, reserved: 7, inTransit: 3 }],
    })
    expect(result.columns.available).toEqual([-4])
    expect(result.total).toBe(-4)
  })

  it('非整数输入 → 拒（ABI v1 只支持 i32）', async () => {
    if (!existsSync(REAL_MANIFEST)) return
    const { executor } = await buildRuntime({})
    await expect(
      executor.invoke({
        atomicType: 'available-inventory',
        version: '^1.0.0',
        records: [{ onHand: 1.5, reserved: 0, inTransit: 0 }],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
})

describe('AtomicExecutor.invoke（拒绝路径）', () => {
  it('字节与绑定哈希不符 → MODULE_HASH_MISMATCH，且不执行', async () => {
    if (!existsSync(REAL_MANIFEST)) return
    const tempDir = mkdtempSync(join(tmpdir(), 'speckit-runtime-'))
    try {
      const realFile = JSON.parse(readFileSync(REAL_MANIFEST, 'utf8')).modules[0]
        .file as string
      const bytes = readFileSync(join(BUILD_DIR, realFile))
      bytes[bytes.length - 1] = bytes[bytes.length - 1] ^ 0xff
      // 文件名里的哈希前缀与实际字节不符：加载器按前缀找到它，校验器发现真不符
      const fakeHash = 'a'.repeat(12)
      writeFileSync(join(tempDir, `available-inventory-${fakeHash}.wasm`), bytes)

      const { executor } = await buildRuntime({
        modulesDir: tempDir,
        sha256: `${fakeHash}${'0'.repeat(52)}`,
      })
      await expect(
        executor.invoke({
          atomicType: 'available-inventory',
          version: '^1.0.0',
          records: [{ onHand: 1, reserved: 0, inTransit: 0 }],
        }),
      ).rejects.toMatchObject({ code: 'MODULE_HASH_MISMATCH' })
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('哈希对但闸 1 不过（含 WASI 导入）→ MODULE_REJECTED_BY_GATE', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'speckit-runtime-gate-'))
    try {
      const rogue = buildFixtureWasm({ importWasi: 'fd_write' })
      const hash = WasmModuleLoader.hash(rogue)
      writeFileSync(
        join(tempDir, `available-inventory-${hash.slice(0, 12)}.wasm`),
        rogue,
      )

      const { executor } = await buildRuntime({
        modulesDir: tempDir,
        sha256: hash,
      })
      await expect(
        executor.invoke({
          atomicType: 'available-inventory',
          version: '^1.0.0',
          records: [{ onHand: 1, reserved: 0, inTransit: 0 }],
        }),
      ).rejects.toMatchObject({ code: 'MODULE_REJECTED_BY_GATE' })
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('死循环被中断且不回退（V8 靠墙钟杀 Worker；Wasmtime 靠 epoch 中断）', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'speckit-runtime-hang-'))
    try {
      const hang = buildHangWasm()
      const hash = WasmModuleLoader.hash(hang)
      writeFileSync(
        join(tempDir, `available-inventory-${hash.slice(0, 12)}.wasm`),
        hang,
      )

      const { executor } = await buildRuntime({ modulesDir: tempDir, sha256: hash })
      await expect(
        executor.invoke({
          atomicType: 'available-inventory',
          version: '^1.0.0',
          records: [{ onHand: 1, reserved: 0, inTransit: 0 }],
          timeoutMs: 500,
        }),
      ).rejects.toMatchObject({
        // 引擎不同，中断手段不同：V8 只能墙钟杀 Worker（EXECUTION_TIMEOUT），
        // Wasmtime 由 epoch 中断（映射为 ATOMIC_FAILED，原因里带 EPOCH_TIMEOUT）。
        // 断言的是"被中断且不返回结果"，而不是某一种引擎的实现细节。
        code: expect.stringMatching(/^(EXECUTION_TIMEOUT|ATOMIC_FAILED)$/),
      })
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('命中吊销名单 → MODULE_REVOKED，且不回退', async () => {
    if (!existsSync(REAL_MANIFEST)) return
    const sha256 = JSON.parse(readFileSync(REAL_MANIFEST, 'utf8')).modules[0]
      .sha256 as string
    const { executor } = await buildRuntime({})

    await expect(
      executor.invoke({
        atomicType: 'available-inventory',
        version: '^1.0.0',
        records: [{ onHand: 1, reserved: 0, inTransit: 0 }],
        revocationList: {
          version: 1,
          issuedAt: new Date().toISOString(),
          revoked: [
            {
              sha256,
              reason: 'security-incident',
              revokedAt: new Date().toISOString(),
              revokedBy: 'test',
            },
          ],
        },
      }),
    ).rejects.toMatchObject({ code: 'MODULE_REVOKED' })
  })

  it('契约声明的权限未满足 → PERMISSION_DENIED；带上权限则正常执行', async () => {
    if (!existsSync(REAL_MANIFEST)) return
    const { executor } = await buildRuntime({
      contract: {
        ...AVAILABLE_INVENTORY_CONTRACT,
        permissions: ['inventory.read'],
      },
    })
    const base = {
      atomicType: 'available-inventory',
      version: '^1.0.0',
      records: [{ onHand: 10, reserved: 4, inTransit: 1 }],
    }

    await expect(
      executor.invoke({ ...base, grantedPermissions: [] }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })

    const allowed = await executor.invoke({
      ...base,
      grantedPermissions: ['inventory.read'],
    })
    expect(allowed.total).toBe(7)
  })

  it('输出超出契约上限 → OUTPUT_LIMIT_EXCEEDED', async () => {
    if (!existsSync(REAL_MANIFEST)) return
    const { executor } = await buildRuntime({
      contract: {
        ...AVAILABLE_INVENTORY_CONTRACT,
        outputSchema: {
          columns: [{ name: 'available', type: 'i32' }],
          total: { name: 'totalAvailable' },
          maxOutputBytes: 4, // 两行 + 合计需要 12 字节
        },
      },
    })
    await expect(
      executor.invoke({
        atomicType: 'available-inventory',
        version: '^1.0.0',
        records: [
          { onHand: 1, reserved: 0, inTransit: 0 },
          { onHand: 2, reserved: 0, inTransit: 0 },
        ],
      }),
    ).rejects.toMatchObject({ code: 'OUTPUT_LIMIT_EXCEEDED' })
  })

  it('输出越出契约值域 → OUTPUT_OUT_OF_RANGE（同一次调用，值域内则放行）', async () => {
    if (!existsSync(REAL_MANIFEST)) return
    const { executor } = await buildRuntime({
      contract: {
        ...AVAILABLE_INVENTORY_CONTRACT,
        outputSchema: {
          // 声明"可用库存不得为负"，但真实模块在超卖时会算出负数
          columns: [{ name: 'available', type: 'i32', minimum: 0 }],
          total: { name: 'totalAvailable' },
          maxOutputBytes: 65536,
        },
      },
    })

    const invoke = (records: Array<Record<string, number>>) =>
      executor.invoke({
        atomicType: 'available-inventory',
        version: '^1.0.0',
        records,
      })

    await expect(
      invoke([{ onHand: 0, reserved: 7, inTransit: 0 }]), // available = -7
    ).rejects.toMatchObject({ code: 'OUTPUT_OUT_OF_RANGE' })

    const ok = await invoke([{ onHand: 10, reserved: 4, inTransit: 1 }]) // 7
    expect(ok.columns.available).toEqual([7])
  })

  it('错误类型统一为 AtomicRuntimeError（供 M4 映射 HTTP 状态码）', async () => {
    if (!existsSync(REAL_MANIFEST)) return
    const { executor } = await buildRuntime({})
    await expect(
      executor.invoke({
        atomicType: 'available-inventory',
        version: '^1.0.0',
        records: [{ onHand: 'x' as never, reserved: 0, inTransit: 0 }],
      }),
    ).rejects.toBeInstanceOf(AtomicRuntimeError)
  })
})

describe('执行预算（cpuBudget）传递链路', () => {
  /** 捕获型引擎：不真执行，只记录收到的调用，用于验证预算是否正确传到引擎。 */
  class CapturingEngine implements WasmEngine {
    calls: Array<{ fuel?: number; rows: number }> = []
    name(): string {
      return 'capturing'
    }
    async run(call: {
      fuel?: number
      rows: number
    }): Promise<{ rc: number; out: Int32Array }> {
      this.calls.push({ fuel: call.fuel, rows: call.rows })
      return { rc: 0, out: Int32Array.from([7, 7]) }
    }
    async close(): Promise<void> {}
  }

  async function buildWithCapturing(contractOverride: Record<string, unknown>) {
    const contracts = fakeRepo()
    const implementations = fakeRepo()
    const registry = new AtomicRegistryService(
      contracts as never,
      implementations as never,
      fakeRepo() as never,
    )
    const contract = await registry.createContract({
      ...AVAILABLE_INVENTORY_CONTRACT,
      ...contractOverride,
    })
    const sha256 = JSON.parse(readFileSync(REAL_MANIFEST, 'utf8')).modules[0]
      .sha256 as string
    await bindRunnableForTest(registry, contract.id, {
      kind: AtomicImplementationKind.WASM,
      moduleSha256: sha256,
      abiVersion: 1,
      tier: 'A' as never,
    })

    const engine = new CapturingEngine()
    const executor = new AtomicExecutor(
      registry,
      new WasmModuleLoader(BUILD_DIR),
      new WasmModuleVerifier(),
      engine,
    )
    return { executor, engine }
  }

  it('契约声明的 cpuBudget 传给引擎（bigint 列以字符串返回也不影响）', async () => {
    if (!existsSync(REAL_MANIFEST)) return
    const { executor, engine } = await buildWithCapturing({ cpuBudget: 5000 })
    await executor.invoke({
      atomicType: 'available-inventory',
      version: '^1.0.0',
      records: [{ onHand: 1, reserved: 0, inTransit: 0 }],
    })
    expect(engine.calls[0].fuel).toBe(5000)
  })

  it('契约未声明预算 → 不覆盖引擎默认（fuel 为 undefined）', async () => {
    if (!existsSync(REAL_MANIFEST)) return
    const { executor, engine } = await buildWithCapturing({})
    await executor.invoke({
      atomicType: 'available-inventory',
      version: '^1.0.0',
      records: [{ onHand: 1, reserved: 0, inTransit: 0 }],
    })
    expect(engine.calls[0].fuel).toBeUndefined()
  })

  it('显式请求的 fuel 优先于契约声明', async () => {
    if (!existsSync(REAL_MANIFEST)) return
    const { executor, engine } = await buildWithCapturing({ cpuBudget: 5000 })
    await executor.invoke({
      atomicType: 'available-inventory',
      version: '^1.0.0',
      records: [{ onHand: 1, reserved: 0, inTransit: 0 }],
      fuel: 777,
    })
    expect(engine.calls[0].fuel).toBe(777)
  })
})
