/**
 * 原子运行时压测：为"实例缓存 / Worker 池"提供决策依据（tasks.md M5 要求"先压测再调优"）。
 *
 * 用内存注册表 + 真实模块产物，隔离出**运行时开销**（不含 DB / HTTP）：
 * 每次 `invoke` 的墙钟耗时分布，以及其中的 Worker 启停成本。
 *
 * 用法：npx ts-node --transpile-only scripts/benchmark-atomic-runtime.ts [迭代次数]
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { AtomicRegistryService } from '../src/atomic-registry/atomic-registry.service'
import { AtomicExecutor } from '../src/atomic-runtime/atomic-executor.service'
import { WasmModuleLoader } from '../src/atomic-runtime/wasm-module-loader'
import { WasmModuleVerifier } from '../src/atomic-runtime/wasm-module-verifier'
import { WasmInstancePool } from '../src/atomic-runtime/wasm-instance-pool'
import { WasmtimeSidecarClient } from '../src/atomic-runtime/wasmtime-sidecar.client'
import { type WasmEngine } from '../src/atomic-runtime/wasm-engine'

const BUILD_DIR = resolve(__dirname, '../../wasm-modules/build')

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
      if (!entity.id) {
        entity.id = `id-${rows.length + 1}`
        rows.push(entity)
      }
      return entity
    },
  }
}

async function buildExecutor() {
  const registry = new AtomicRegistryService(
    fakeRepo() as never,
    fakeRepo() as never,
    fakeRepo() as never,
  )
  const contract = await registry.createContract({
    atomicType: 'available-inventory',
    version: '1.0.0',
    kind: 'calculation',
    status: 'active',
    inputSchema: {
      rows: { source: '$lines', max: 100000 },
      columns: [
        { name: 'onHand', source: '$line.onHand', type: 'i32' },
        { name: 'reserved', source: '$line.reserved', type: 'i32' },
        { name: 'inTransit', source: '$line.inTransit', type: 'i32' },
      ],
    },
    outputSchema: {
      columns: [{ name: 'available', type: 'i32' }],
      total: { name: 'totalAvailable' },
      maxOutputBytes: 1 << 20,
    },
  })
  const sha256 = JSON.parse(
    readFileSync(join(BUILD_DIR, 'manifest.json'), 'utf8'),
  ).modules[0].sha256 as string
  await registry.bindImplementation(contract.id, {
    kind: 'wasm' as never,
    moduleSha256: sha256,
    abiVersion: 1,
    tier: 'A' as never,
    status: 'active' as never,
  })
  // 引擎可按环境变量切换，用于两套引擎的对拍（ATOMIC_ENGINE=v8|wasmtime）
  const engineKind = (process.env.ATOMIC_ENGINE ?? 'wasmtime').toLowerCase()
  const pool: WasmEngine =
    engineKind === 'wasmtime'
      ? new WasmtimeSidecarClient(
          resolve(__dirname, '../../crates/wasm-host/target/release/wasm-host'),
        )
      : new WasmInstancePool()
  return {
    executor: new AtomicExecutor(
      registry,
      new WasmModuleLoader(BUILD_DIR),
      new WasmModuleVerifier(),
      pool,
    ),
    pool,
  }
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[index]
}

async function main(): Promise<void> {
  const iterations = Number(process.argv[2] ?? 50)
  const { executor, pool } = await buildExecutor()

  // 行数三档：小（2 行 / 调用开销主导）、中（1000 行）、大（20000 行 / 计算量主导）
  for (const rows of [2, 1000, 20000]) {
    const records = Array.from({ length: rows }, (_, i) => ({
      onHand: 100 + i,
      reserved: i % 7,
      inTransit: 3,
    }))
    const samples: number[] = []
    let fuelUsed: number | undefined
    for (let i = 0; i < iterations; i += 1) {
      const started = Date.now()
      const result = await executor.invoke({
        atomicType: 'available-inventory',
        version: '^1.0.0',
        records,
      })
      fuelUsed = result.fuelUsed ?? fuelUsed
      samples.push(Date.now() - started)
    }
    samples.sort((a, b) => a - b)
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    console.log(
      `rows=${String(rows).padStart(6)}  n=${iterations}` +
        `  mean=${mean.toFixed(1)}ms  p50=${percentile(samples, 50)}ms` +
        `  p95=${percentile(samples, 95)}ms  max=${samples[samples.length - 1]}ms` +
        `  throughput≈${(1000 / mean).toFixed(1)}/s` +
        // 指令用量（仅 wasmtime 引擎提供）：预算校准的依据
        `  fuel=${fuelUsed ?? 'n/a'}`,
    )
  }

  // 常驻 Worker 会让事件循环保持活跃：压测收尾必须显式关闭，否则进程不退出
  await pool.close()
}

void main()
