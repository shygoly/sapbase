/**
 * 汽配五原子契约的唯一真源。
 *
 * 为什么单独成文件：契约列布局 / 错误码 / 权限点必须与 Wasm ABI 一一对应，
 * seed、单元测试、e2e 都从这里取，禁止各写一份（元语不变量 12）。
 * 实现哈希不写死在契约里 —— 登记时读 `wasm-modules/build/manifest.json` 并对字节重算。
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ConflictException } from '@nestjs/common'
import { AtomicRegistryService } from '../atomic-registry/atomic-registry.service'
import { bindRunnableForTest } from '../atomic-registry/test-fixtures'
import {
  AdmissionTier,
  AtomicImplementationKind,
} from '../atomic-registry/atomic-implementation.entity'

/** ABI v1 错误码（与各 crate `run` 的返回值一致）。 */
export const AUTOPARTS_ERROR = {
  INVALID_ARGUMENT: 1,
  SUPERSESSION_CYCLE: 2,
  INEXACT_CONVERSION: 3,
  INVALID_RATIO: 4,
  NO_STANDARD_PRICE: 5,
  INVALID_KIND: 6,
  NEGATIVE_INPUT: 7,
  OVERFLOW: 8,
} as const

/** 权限点：复用 RBAC 点分格式，每个原子一个调用点。 */
export const AUTOPARTS_PERMISSIONS = {
  atp: 'autoparts.atp.invoke',
  price: 'autoparts.price.invoke',
  credit: 'autoparts.credit.invoke',
  uom: 'autoparts.uom.invoke',
  supersession: 'autoparts.supersession.invoke',
} as const

export const AUTOPARTS_ATOMIC_TYPES = [
  'autoparts-atp',
  'autoparts-price',
  'autoparts-credit',
  'autoparts-uom-convert',
  'autoparts-supersession',
] as const

export type AutopartsAtomicType = (typeof AUTOPARTS_ATOMIC_TYPES)[number]

/**
 * 闸 3 档位：
 * - 行间有图/选择语义的原子必须 `off`：逐行重放会把 `replacedBy` 下标打飞，
 *   O4 会得到假阴性（并不是模块在泄漏，是批量语义本身不可逐行拆）。
 * - 行独立的换算/信用走 `standard`，让闸 3 真的判 O4。
 */
export type AutopartsContractDef = {
  atomicType: AutopartsAtomicType
  version: '1.0.0'
  kind: 'calculation'
  status: 'active'
  description: string
  permissions: string[]
  errors: string[]
  outputAudit: 'off' | 'standard'
  /** off 必填（校验器强制）：为什么这个原子不能跑追加判据 */
  outputAuditReason?: string
  inputSchema: {
    rows: { source: '$lines'; max: number }
    columns: Array<{ name: string; source: string; type: 'i32' }>
  }
  outputSchema: {
    columns: Array<{
      name: string
      type: 'i32'
      minimum?: number
      maximum?: number
    }>
    total: { name: string }
    maxOutputBytes: number
  }
}

/** i32 全区间：未声明更窄值域时的溢出边界（闸 3 O2 兜底与模块 ERR_OVERFLOW 对齐）。 */
const I32 = { minimum: -2147483648, maximum: 2147483647 }

export const AUTOPARTS_CONTRACTS: AutopartsContractDef[] = [
  {
    atomicType: 'autoparts-atp',
    version: '1.0.0',
    kind: 'calculation',
    status: 'active',
    description:
      '可用量 + 替代件单向合并。数量为整数小单位（标度由宿主约定，默认 0）。' +
      '第 0 行是被查询零件；counted[j]=1 当且仅当从 j 沿 replacedBy 能走到 0。',
    permissions: [AUTOPARTS_PERMISSIONS.atp],
    errors: ['INVALID_ARGUMENT', 'SUPERSESSION_CYCLE', 'OVERFLOW'],
    outputAudit: 'off',
    outputAuditReason:
      '行间依赖：本原子按整批语义计算（如 replacedBy 指向其他行、按 kind/minQty 选行），逐行重放会把行内引用打飞，O4 会得到假阳性。故不跑追加判据；O1/O2/O3 仍判。',
    inputSchema: {
      rows: { source: '$lines', max: 4096 },
      columns: [
        { name: 'onHand', source: '$line.onHand', type: 'i32' },
        { name: 'reserved', source: '$line.reserved', type: 'i32' },
        { name: 'committed', source: '$line.committed', type: 'i32' },
        { name: 'inTransit', source: '$line.inTransit', type: 'i32' },
        { name: 'replacedBy', source: '$line.replacedBy', type: 'i32' },
      ],
    },
    outputSchema: {
      columns: [
        { name: 'atp', type: 'i32', ...I32 },
        { name: 'counted', type: 'i32', minimum: 0, maximum: 1 },
        { name: 'replacedBy', type: 'i32', minimum: -1, maximum: 4095 },
      ],
      total: { name: 'totalAtp' },
      maxOutputBytes: 65536,
    },
  },
  {
    atomicType: 'autoparts-price',
    version: '1.0.0',
    kind: 'calculation',
    status: 'active',
    description:
      '价格解析：最小 kind → 同 kind 最大 minQty → 最小下标。' +
      'kind 0 客户等级价 / 1 阶梯价 / 2 最近成交价 / 3 标准价。金额为整数小单位。',
    permissions: [AUTOPARTS_PERMISSIONS.price],
    errors: ['INVALID_ARGUMENT', 'NO_STANDARD_PRICE', 'INVALID_KIND'],
    outputAudit: 'off',
    outputAuditReason:
      '行间依赖：本原子按整批语义计算（如 replacedBy 指向其他行、按 kind/minQty 选行），逐行重放会把行内引用打飞，O4 会得到假阳性。故不跑追加判据；O1/O2/O3 仍判。',
    inputSchema: {
      rows: { source: '$lines', max: 1024 },
      columns: [
        { name: 'kind', source: '$line.kind', type: 'i32' },
        { name: 'minQty', source: '$line.minQty', type: 'i32' },
        { name: 'priceMinor', source: '$line.priceMinor', type: 'i32' },
      ],
    },
    outputSchema: {
      columns: [
        { name: 'selected', type: 'i32', minimum: 0, maximum: 1 },
        { name: 'kind', type: 'i32', minimum: 0, maximum: 3 },
        { name: 'priceMinor', type: 'i32', ...I32 },
      ],
      total: { name: 'selectedPrice' },
      maxOutputBytes: 65536,
    },
  },
  {
    atomicType: 'autoparts-credit',
    version: '1.0.0',
    kind: 'calculation',
    status: 'active',
    description:
      '信用检查：available = limit − receivable − inFlight；overLimit = order > available。' +
      '额度/应收/本单三项依据必须回显。金额为整数小单位。',
    permissions: [AUTOPARTS_PERMISSIONS.credit],
    errors: ['INVALID_ARGUMENT', 'NEGATIVE_INPUT', 'OVERFLOW'],
    outputAudit: 'standard',
    inputSchema: {
      rows: { source: '$lines', max: 1024 },
      columns: [
        { name: 'limitMinor', source: '$line.limitMinor', type: 'i32' },
        { name: 'receivableMinor', source: '$line.receivableMinor', type: 'i32' },
        { name: 'inFlightMinor', source: '$line.inFlightMinor', type: 'i32' },
        { name: 'orderMinor', source: '$line.orderMinor', type: 'i32' },
      ],
    },
    outputSchema: {
      columns: [
        { name: 'availableMinor', type: 'i32', ...I32 },
        { name: 'overLimit', type: 'i32', minimum: 0, maximum: 1 },
        { name: 'limitMinor', type: 'i32', ...I32 },
        { name: 'receivableMinor', type: 'i32', ...I32 },
        { name: 'orderMinor', type: 'i32', ...I32 },
      ],
      total: { name: 'totalAvailable' },
      maxOutputBytes: 65536,
    },
  },
  {
    atomicType: 'autoparts-uom-convert',
    version: '1.0.0',
    kind: 'calculation',
    status: 'active',
    description:
      '单位换算：qtyMinor × numerator / denominator，禁止浮点。' +
      '数量标度 3（2.500 箱 = 2500）。rounding 0=只整除，1=half-up（一半及以上远离 0）。',
    permissions: [AUTOPARTS_PERMISSIONS.uom],
    errors: ['INVALID_ARGUMENT', 'INEXACT_CONVERSION', 'INVALID_RATIO', 'OVERFLOW'],
    outputAudit: 'standard',
    inputSchema: {
      rows: { source: '$lines', max: 10000 },
      columns: [
        { name: 'qtyMinor', source: '$line.qtyMinor', type: 'i32' },
        { name: 'numerator', source: '$line.numerator', type: 'i32' },
        { name: 'denominator', source: '$line.denominator', type: 'i32' },
        { name: 'rounding', source: '$line.rounding', type: 'i32' },
      ],
    },
    outputSchema: {
      columns: [{ name: 'convertedMinor', type: 'i32', ...I32 }],
      total: { name: 'totalConverted' },
      maxOutputBytes: 65536,
    },
  },
  {
    atomicType: 'autoparts-supersession',
    version: '1.0.0',
    kind: 'calculation',
    status: 'active',
    description:
      '替代链解析：旧件 → 新件。canonical 是最末端下标，depth 是跳数，' +
      'total 是不同 canonical 的个数（供宿主按最新件合并数量）。',
    permissions: [AUTOPARTS_PERMISSIONS.supersession],
    errors: ['INVALID_ARGUMENT', 'SUPERSESSION_CYCLE'],
    outputAudit: 'off',
    outputAuditReason:
      '行间依赖：本原子按整批语义计算（如 replacedBy 指向其他行、按 kind/minQty 选行），逐行重放会把行内引用打飞，O4 会得到假阳性。故不跑追加判据；O1/O2/O3 仍判。',
    inputSchema: {
      rows: { source: '$lines', max: 4096 },
      columns: [{ name: 'replacedBy', source: '$line.replacedBy', type: 'i32' }],
    },
    outputSchema: {
      columns: [
        { name: 'canonical', type: 'i32', minimum: 0, maximum: 4095 },
        { name: 'depth', type: 'i32', minimum: 0, maximum: 4096 },
      ],
      total: { name: 'distinctCanonical' },
      maxOutputBytes: 65536,
    },
  },
]

const DEFAULT_BUILD_DIR = resolve(__dirname, '../../../wasm-modules/build')

export interface AutopartsManifestEntry {
  atomicType: string
  file: string
  sha256: string
}

/** 读清单并对字节重算哈希（不采信自述）。缺模块或哈希不符即抛。 */
export function readAutopartsManifest(
  buildDir: string = DEFAULT_BUILD_DIR,
): Record<AutopartsAtomicType, AutopartsManifestEntry> {
  const manifestPath = join(buildDir, 'manifest.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`找不到原子清单：${manifestPath}`)
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    modules: AutopartsManifestEntry[]
  }
  const out = {} as Record<AutopartsAtomicType, AutopartsManifestEntry>
  for (const type of AUTOPARTS_ATOMIC_TYPES) {
    const entry = manifest.modules.find((m) => m.atomicType === type)
    if (!entry) {
      throw new Error(`清单里没有 ${type}（先走 admit-cli 过闸 0/1/2）`)
    }
    const bytes = readFileSync(join(buildDir, entry.file))
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    if (sha256 !== entry.sha256) {
      throw new Error(
        `清单自述哈希不可信：${type} file=${entry.file} claimed=${entry.sha256} actual=${sha256}`,
      )
    }
    out[type] = { ...entry, sha256 }
  }
  return out
}

export function contractPayload(def: AutopartsContractDef): Record<string, unknown> {
  return {
    atomicType: def.atomicType,
    version: def.version,
    kind: def.kind,
    status: def.status,
    description: def.description,
    permissions: def.permissions,
    errors: def.errors,
    outputAudit: def.outputAudit,
    ...(def.outputAuditReason ? { outputAuditReason: def.outputAuditReason } : {}),
    inputSchema: def.inputSchema,
    outputSchema: def.outputSchema,
  }
}

/**
 * 幂等登记：契约已在则复用，实现未可运行则按清单哈希绑定（闸 4 补录，理由写明）。
 * 为什么用补录而不是跳级：生产晋升必须逐级带证据；这里是平台自研 Tier A 的部署入口。
 */
export async function registerAutopartsContracts(
  registry: AtomicRegistryService,
  options: { buildDir?: string } = {},
): Promise<Array<{ atomicType: string; contractId: string; sha256: string }>> {
  const manifest = readAutopartsManifest(options.buildDir ?? DEFAULT_BUILD_DIR)
  const registered: Array<{ atomicType: string; contractId: string; sha256: string }> =
    []

  for (const def of AUTOPARTS_CONTRACTS) {
    const existing = (await registry.list(def.atomicType)).find(
      (c) => c.version === def.version,
    )
    const contract =
      existing ??
      (await createOrReuse(registry, contractPayload(def)))

    const sha256 = manifest[def.atomicType].sha256
    try {
      await registry.resolve(def.atomicType, `^${def.version}`)
    } catch {
      await bindRunnableForTest(registry, contract.id, {
        kind: AtomicImplementationKind.WASM,
        moduleSha256: sha256,
        abiVersion: 1,
        tier: AdmissionTier.A,
      })
    }
    registered.push({ atomicType: def.atomicType, contractId: contract.id, sha256 })
  }
  return registered
}

async function createOrReuse(
  registry: AtomicRegistryService,
  payload: Record<string, unknown>,
) {
  try {
    return await registry.createContract(payload)
  } catch (error) {
    if (error instanceof ConflictException) {
      const type = payload.atomicType as string
      const found = (await registry.list(type)).find(
        (c) => c.version === payload.version,
      )
      if (found) return found
    }
    throw error
  }
}

/** 给 seed / 测试解析清单目录（相对本文件，可用 ATOMIC_MODULES_DIR 覆盖）。 */
export function defaultAutopartsBuildDir(): string {
  return process.env.ATOMIC_MODULES_DIR ?? DEFAULT_BUILD_DIR
}
