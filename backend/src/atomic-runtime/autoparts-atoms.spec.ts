/**
 * 汽配五原子：契约形状 + **真实 Wasm 字节**的算法往返。
 *
 * 为什么不在 Rust 里写 cargo test：no_std + cdylib 跑不了宿主测试。
 * 本文件直接 `WebAssembly.Instance` 调准入产物（不是 TS 复述算法），
 * 所以红绿证明的是入库 .wasm，而不是一份平行实现。
 */
/**
 * Jest 的 tsconfig 不含 DOM lib，但 Node 运行时有 WebAssembly。
 * 这里只声明本文件用到的三个构造器，避免把整份 DOM 拉进测试类型。
 */
declare const WebAssembly: {
  Memory: new (opts: { initial: number; maximum?: number }) => { buffer: ArrayBuffer }
  Module: new (bytes: Uint8Array) => object
  Instance: new (
    module: object,
    imports: { env: { memory: { buffer: ArrayBuffer } } },
  ) => { exports: Record<string, unknown> }
}

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { AtomicRegistryService } from '../atomic-registry/atomic-registry.service'
import { validateAtomicContract } from '../atomic-registry/contract-validator'
import {
  AUTOPARTS_ATOMIC_TYPES,
  AUTOPARTS_CONTRACTS,
  AUTOPARTS_ERROR,
  AUTOPARTS_PERMISSIONS,
  contractPayload,
  readAutopartsManifest,
  registerAutopartsContracts,
} from './autoparts-contracts'

const BUILD_DIR = resolve(__dirname, '../../../wasm-modules/build')

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

function loadBytes(atomicType: string): Uint8Array {
  const entry = readAutopartsManifest(BUILD_DIR)[atomicType as keyof ReturnType<typeof readAutopartsManifest>]
  return new Uint8Array(readFileSync(join(BUILD_DIR, entry.file)))
}

/** 列优先写入线性内存，调用真实 run。rc≠0 时不读输出（模块保证不部分提交）。 */
function invokeWasm(
  bytes: Uint8Array,
  inputCols: number[][],
  outputColCount: number,
  offsets?: { inOff?: number; outOff?: number; n?: number },
): { rc: number; columns: number[][]; total: number } {
  const n = offsets?.n ?? inputCols[0]?.length ?? 0
  const memory = new WebAssembly.Memory({ initial: 2, maximum: 1024 })
  const inst = new WebAssembly.Instance(new WebAssembly.Module(bytes), {
    env: { memory },
  })
  const abi = inst.exports.abi_version as (() => number) | undefined
  expect(typeof abi).toBe('function')
  expect(abi?.()).toBe(1)
  const view = new DataView(memory.buffer)
  const inOff = offsets?.inOff ?? 0
  if (offsets?.inOff === undefined && n > 0) {
    inputCols.forEach((col, ci) => {
      col.forEach((value, i) => {
        view.setInt32(inOff + (ci * n + i) * 4, value, true)
      })
    })
  }
  const outOff = offsets?.outOff ?? inputCols.length * Math.max(n, 0) * 4
  const rc = (inst.exports.run as (a: number, b: number, c: number) => number)(
    inOff,
    n,
    outOff,
  )
  if (rc !== 0) return { rc, columns: [], total: 0 }
  const columns: number[][] = []
  for (let ci = 0; ci < outputColCount; ci += 1) {
    const col: number[] = []
    for (let i = 0; i < n; i += 1) {
      col.push(view.getInt32(outOff + (ci * n + i) * 4, true))
    }
    columns.push(col)
  }
  return {
    rc,
    columns,
    total: view.getInt32(outOff + outputColCount * n * 4, true),
  }
}

describe('汽配原子契约形状（唯一真源）', () => {
  it('五份契约通过 atomic-contract.schema.json，权限点与错误码齐全', () => {
    expect(AUTOPARTS_CONTRACTS).toHaveLength(5)
    for (const def of AUTOPARTS_CONTRACTS) {
      const result = validateAtomicContract(contractPayload(def))
      expect(result.errors).toEqual([])
      expect(result.valid).toBe(true)
      expect(def.kind).toBe('calculation')
      expect(def.version).toBe('1.0.0')
      expect(def.status).toBe('active')
      expect(def.inputSchema.rows.source).toBe('$lines')
      for (const col of def.inputSchema.columns) {
        expect(col.source.startsWith('$line.')).toBe(true)
        expect(col.type).toBe('i32')
      }
    }
    expect(AUTOPARTS_PERMISSIONS.atp).toBe('autoparts.atp.invoke')
    expect(AUTOPARTS_ATOMIC_TYPES).toEqual([
      'autoparts-atp',
      'autoparts-price',
      'autoparts-credit',
      'autoparts-uom-convert',
      'autoparts-supersession',
    ])
  })

  it('清单 5 个模块的入库字节与自述哈希一致（不采信自述）', () => {
    const manifest = readAutopartsManifest(BUILD_DIR)
    for (const type of AUTOPARTS_ATOMIC_TYPES) {
      const entry = manifest[type]
      const actual = createHash('sha256')
        .update(readFileSync(join(BUILD_DIR, entry.file)))
        .digest('hex')
      expect(actual).toBe(entry.sha256)
    }
  })
})

describe('autoparts-atp（真实 Wasm）', () => {
  const bytes = () => loadBytes('autoparts-atp')

  it('替代件合并：X=5 Y=3 Y.replacedBy=0 → 查 X 得 8', () => {
    const out = invokeWasm(
      bytes(),
      [
        [5, 3],
        [0, 0],
        [0, 0],
        [0, 0],
        [-1, 0],
      ],
      3,
    )
    expect(out.rc).toBe(0)
    expect(out.columns[0]).toEqual([5, 3])
    expect(out.columns[1]).toEqual([1, 1])
    expect(out.total).toBe(8)
  })

  it('方向单向：只投影 Y 一行 → 3，不含 X', () => {
    const out = invokeWasm(bytes(), [[3], [0], [0], [0], [-1]], 3)
    expect(out.rc).toBe(0)
    expect(out.columns[0]).toEqual([3])
    expect(out.columns[1]).toEqual([1])
    expect(out.total).toBe(3)
  })

  it('现存量 10、预留 3、在途 2、committed 0 → 9', () => {
    const out = invokeWasm(bytes(), [[10], [3], [0], [2], [-1]], 3)
    expect(out.rc).toBe(0)
    expect(out.columns[0]).toEqual([9])
    expect(out.total).toBe(9)
  })

  it('负例：replacedBy 成环 → SUPERSESSION_CYCLE', () => {
    const out = invokeWasm(
      bytes(),
      [
        [1, 1],
        [0, 0],
        [0, 0],
        [0, 0],
        [1, 0],
      ],
      3,
    )
    expect(out.rc).toBe(AUTOPARTS_ERROR.SUPERSESSION_CYCLE)
  })

  it('负例：i32 溢出 → OVERFLOW（不许回绕）', () => {
    const out = invokeWasm(bytes(), [[2000000000], [0], [0], [2000000000], [-1]], 3)
    expect(out.rc).toBe(AUTOPARTS_ERROR.OVERFLOW)
  })

  it('负例：n < 0 → INVALID_ARGUMENT', () => {
    const out = invokeWasm(bytes(), [[1], [0], [0], [0], [-1]], 3, { n: -1 })
    expect(out.rc).toBe(AUTOPARTS_ERROR.INVALID_ARGUMENT)
  })
})

describe('autoparts-uom-convert（真实 Wasm）', () => {
  const bytes = () => loadBytes('autoparts-uom-convert')

  it('2.5 箱 × 12 套/箱 → 精确 30.000（标度 3，无浮点）', () => {
    const out = invokeWasm(bytes(), [[2500], [12], [1], [0]], 1)
    expect(out.rc).toBe(0)
    expect(out.columns[0]).toEqual([30000])
    expect(out.total).toBe(30000)
  })

  it('负例：rounding=0 且不整除 → INEXACT_CONVERSION', () => {
    const out = invokeWasm(bytes(), [[5], [1], [2], [0]], 1)
    expect(out.rc).toBe(AUTOPARTS_ERROR.INEXACT_CONVERSION)
  })

  it('rounding=1 时 5/2 half-up → 3（整数余数，不用浮点）', () => {
    const out = invokeWasm(bytes(), [[5], [1], [2], [1]], 1)
    expect(out.rc).toBe(0)
    expect(out.columns[0]).toEqual([3])
  })

  it('负例：denominator<=0 / numerator<0 → INVALID_RATIO', () => {
    expect(invokeWasm(bytes(), [[1], [1], [0], [0]], 1).rc).toBe(
      AUTOPARTS_ERROR.INVALID_RATIO,
    )
    expect(invokeWasm(bytes(), [[1], [-1], [1], [0]], 1).rc).toBe(
      AUTOPARTS_ERROR.INVALID_RATIO,
    )
  })

  it('负例：乘积超出 i32 → OVERFLOW', () => {
    const out = invokeWasm(bytes(), [[2000000000], [3], [1], [0]], 1)
    expect(out.rc).toBe(AUTOPARTS_ERROR.OVERFLOW)
  })
})

describe('autoparts-price（真实 Wasm）', () => {
  const bytes = () => loadBytes('autoparts-price')

  it('命中 A 级价并带 kind 依据', () => {
    const out = invokeWasm(
      bytes(),
      [
        [0, 3],
        [0, 0],
        [8800, 10000],
      ],
      3,
    )
    expect(out.rc).toBe(0)
    expect(out.columns[0]).toEqual([1, 0])
    expect(out.columns[1]).toEqual([0, 3])
    expect(out.total).toBe(8800)
  })

  it('无特定价 → 回落标准价', () => {
    const out = invokeWasm(bytes(), [[3], [0], [10000]], 3)
    expect(out.rc).toBe(0)
    expect(out.columns[0]).toEqual([1])
    expect(out.columns[1]).toEqual([3])
    expect(out.total).toBe(10000)
  })

  it('同 kind 取最大 minQty，并列取最小下标', () => {
    const out = invokeWasm(
      bytes(),
      [
        [1, 1, 3],
        [10, 5, 0],
        [80, 90, 100],
      ],
      3,
    )
    expect(out.rc).toBe(0)
    expect(out.columns[0]).toEqual([1, 0, 0])
    expect(out.total).toBe(80)
  })

  it('负例：缺标准价 → NO_STANDARD_PRICE', () => {
    const out = invokeWasm(bytes(), [[0], [0], [8800]], 3)
    expect(out.rc).toBe(AUTOPARTS_ERROR.NO_STANDARD_PRICE)
  })

  it('负例：非法 kind → INVALID_KIND', () => {
    const out = invokeWasm(bytes(), [[9, 3], [0, 0], [1, 2]], 3)
    expect(out.rc).toBe(AUTOPARTS_ERROR.INVALID_KIND)
  })
})

describe('autoparts-credit（真实 Wasm）', () => {
  const bytes = () => loadBytes('autoparts-credit')

  it('额度 100000、应收 90000、本单 20000 → overLimit=1 且回显三项依据', () => {
    const out = invokeWasm(bytes(), [[100000], [90000], [0], [20000]], 5)
    expect(out.rc).toBe(0)
    expect(out.columns[0]).toEqual([10000])
    expect(out.columns[1]).toEqual([1])
    expect(out.columns[2]).toEqual([100000])
    expect(out.columns[3]).toEqual([90000])
    expect(out.columns[4]).toEqual([20000])
    expect(out.total).toBe(10000)
  })

  it('负例：负数入参 → NEGATIVE_INPUT', () => {
    const out = invokeWasm(bytes(), [[100], [-1], [0], [0]], 5)
    expect(out.rc).toBe(AUTOPARTS_ERROR.NEGATIVE_INPUT)
  })

  it('负例：available 溢出 i32 → OVERFLOW', () => {
    const out = invokeWasm(bytes(), [[0], [2147483647], [2], [0]], 5)
    expect(out.rc).toBe(AUTOPARTS_ERROR.OVERFLOW)
  })
})

describe('autoparts-supersession（真实 Wasm）', () => {
  const bytes = () => loadBytes('autoparts-supersession')

  it('旧→新：Y 指向 X，canonical 都是 0，distinct=1（供宿主合并）', () => {
    const out = invokeWasm(bytes(), [[-1, 0]], 2)
    expect(out.rc).toBe(0)
    expect(out.columns[0]).toEqual([0, 0])
    expect(out.columns[1]).toEqual([0, 1])
    expect(out.total).toBe(1)
  })

  it('两条独立链 → distinct=2', () => {
    const out = invokeWasm(bytes(), [[-1, -1]], 2)
    expect(out.rc).toBe(0)
    expect(out.columns[0]).toEqual([0, 1])
    expect(out.total).toBe(2)
  })

  it('负例：成环 → SUPERSESSION_CYCLE，不返回部分结果', () => {
    const out = invokeWasm(bytes(), [[1, 0]], 2)
    expect(out.rc).toBe(AUTOPARTS_ERROR.SUPERSESSION_CYCLE)
    expect(out.columns).toEqual([])
  })

  it('负例：越界 → SUPERSESSION_CYCLE', () => {
    const out = invokeWasm(bytes(), [[5]], 2)
    expect(out.rc).toBe(AUTOPARTS_ERROR.SUPERSESSION_CYCLE)
  })
})

describe('registerAutopartsContracts（幂等登记）', () => {
  it('读清单绑定 sha256，第二次调用不抛', async () => {
    const contracts = fakeRepo()
    const implementations = fakeRepo()
    const registry = new AtomicRegistryService(
      contracts as never,
      implementations as never,
      fakeRepo() as never,
    )
    const first = await registerAutopartsContracts(registry, { buildDir: BUILD_DIR })
    expect(first).toHaveLength(5)
    expect(first.every((row) => row.sha256.length === 64)).toBe(true)
    const second = await registerAutopartsContracts(registry, { buildDir: BUILD_DIR })
    expect(second.map((r) => r.atomicType)).toEqual(first.map((r) => r.atomicType))
    expect(implementations.rows).toHaveLength(5)
  })
})
