// 契约与清单校验的准入测试。
//
// 规则（见 backend/AGENTS.md）：协议/契约类逻辑必须带**负例** —— 每类违规一个拒绝用例，
// 只测正路径不算完成。
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  validateAtomicContract,
  validateModuleManifest,
} from './contract-validator'
import { resolveSchemasDir } from '../common/protocol/schema-loader'

/** 可用库存原子的真实契约（与 wasm-modules 的 ABI v1 对应）。 */
const VALID_CONTRACT = {
  atomicType: 'available-inventory',
  version: '1.0.0',
  kind: 'calculation',
  description: '可用库存 = 现有库存 - 已预留库存 + 在途库存',
  status: 'active',
  inputSchema: {
    rows: { source: '$lines', max: 10000 },
    columns: [
      { name: 'onHand', source: '$line.onHand', type: 'i32' },
      { name: 'reserved', source: '$line.reserved', type: 'i32' },
      { name: 'inTransit', source: '$line.inTransit', type: 'i32' },
    ],
  },
  outputSchema: {
    columns: [{ name: 'available', type: 'i32' }],
    total: { name: 'totalAvailable' },
    maxOutputBytes: 4096,
  },
  permissions: ['inventory.read'],
  errors: ['INSUFFICIENT_INVENTORY'],
  idempotency: 'none',
  implementation: {
    kind: 'wasm',
    moduleSha256: '54c7674e402c268b7b3bf29cd2fb496557c836c7e82c95684db12147d13d8736',
    abiVersion: 1,
    tier: 'A',
    reproducibleBuildRef:
      'repro:rust:1.95.0:54c7674e402c268b7b3bf29cd2fb496557c836c7e82c95684db12147d13d8736',
  },
}

/** 在合法契约上做局部修改，构造负例。 */
function withContract(patch: Record<string, unknown>): Record<string, unknown> {
  return { ...VALID_CONTRACT, ...patch }
}

describe('validateAtomicContract', () => {
  it('接受合法的计算型契约（含 Wasm 实现绑定）', () => {
    const result = validateAtomicContract(VALID_CONTRACT)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('接受不绑定实现的纯契约（先定义接口、后接实现）', () => {
    const { implementation: _ignored, ...contractWithoutImplementation } =
      VALID_CONTRACT
    expect(validateAtomicContract(contractWithoutImplementation).valid).toBe(
      true,
    )
  })

  it('接受 TypeScript 实现（平台自研，无需模块哈希）', () => {
    const result = validateAtomicContract(
      withContract({ implementation: { kind: 'typescript' } }),
    )
    expect(result.valid).toBe(true)
  })

  it('接受可选执行预算 cpuBudget', () => {
    expect(validateAtomicContract(withContract({ cpuBudget: 5000 })).valid).toBe(
      true,
    )
  })

  // 闸 3（输出管控）的声明前提：判据见 docs/protocols/atomic-output-audit.md
  it.each([
    ['off', { outputAuditReason: '行间依赖：逐行重放不成立（测试夹具）' }],
    ['standard', {}],
    ['strict', {}],
  ])('接受 outputAudit 档位 %s', (profile, extra) => {
    expect(
      validateAtomicContract(withContract({ outputAudit: profile, ...extra })).valid,
    ).toBe(true)
  })

  it('拒绝：off 不带理由（没有理由的 off 就是关闸的万能钥匙）', () => {
    const result = validateAtomicContract(withContract({ outputAudit: 'off' }))
    expect(result.valid).toBe(false)
    expect(result.errors.join('; ')).toContain('outputAuditReason')
  })

  it('未声明 outputAudit 时按默认档位处理（可选，不是必填）', () => {
    expect((VALID_CONTRACT as Record<string, unknown>).outputAudit).toBeUndefined()
    expect(validateAtomicContract(VALID_CONTRACT).valid).toBe(true)
  })

  it('拒绝未知的 outputAudit 档位', () => {
    const result = validateAtomicContract(withContract({ outputAudit: 'paranoid' }))
    expect(result.valid).toBe(false)
    expect(result.errors.join('; ')).toContain('outputAudit')
  })

  it('接受声明可交换（commutative）的输出', () => {
    const contract = withContract({
      outputSchema: { ...VALID_CONTRACT.outputSchema, commutative: true },
    })
    expect(validateAtomicContract(contract).valid).toBe(true)
  })

  it('拒绝值域倒置的输出列（跨字段判据，Schema 表达不了）', () => {
    const result = validateAtomicContract(
      withContract({
        outputSchema: {
          columns: [{ name: 'available', type: 'i32', minimum: 100, maximum: 0 }],
          total: { name: 'totalAvailable' },
        },
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.join('; ')).toContain('minimum (100) 不得大于 maximum (0)')
  })

  it('拒绝汇总位与输出列同名（输出布局有歧义）', () => {
    const result = validateAtomicContract(
      withContract({
        outputSchema: {
          columns: [{ name: 'available', type: 'i32' }],
          total: { name: 'available' },
        },
      }),
    )
    expect(result.valid).toBe(false)
    expect(result.errors.join('; ')).toContain('与输出列同名')
  })

  it.each([
    [
      'v1 不允许写入型原子（command）',
      withContract({ kind: 'command' }),
      'kind',
    ],
    [
      'v1 不允许 effect 型原子',
      withContract({ kind: 'effect' }),
      'kind',
    ],
    [
      'Wasm 实现缺少模块哈希',
      withContract({ implementation: { kind: 'wasm', abiVersion: 1, tier: 'A' } }),
      'moduleSha256',
    ],
    [
      '模块哈希格式非法（非 64 位 hex）',
      withContract({
        implementation: {
          kind: 'wasm',
          moduleSha256: 'not-a-hash',
          abiVersion: 1,
          tier: 'A',
        },
      }),
      'moduleSha256',
    ],
    [
      'ABI 版本不是 1',
      withContract({
        implementation: {
          kind: 'wasm',
          moduleSha256: VALID_CONTRACT.implementation.moduleSha256,
          abiVersion: 2,
          tier: 'A',
        },
      }),
      'abiVersion',
    ],
    [
      'Tier B 缺少审查背书',
      withContract({
        implementation: {
          kind: 'wasm',
          moduleSha256: VALID_CONTRACT.implementation.moduleSha256,
          abiVersion: 1,
          tier: 'B',
        },
      }),
      'review',
    ],
    [
      'atomicType 不是 kebab-case',
      withContract({ atomicType: 'AvailableInventory' }),
      'atomicType',
    ],
    [
      'version 不是语义化版本',
      withContract({ version: 'v1' }),
      'version',
    ],
    [
      '缺少输入投影',
      (() => {
        const { inputSchema: _drop, ...rest } = VALID_CONTRACT as Record<
          string,
          unknown
        >
        return rest
      })(),
      'inputSchema',
    ],
    [
      '输入列类型不是 ABI v1 支持的 i32',
      withContract({
        inputSchema: {
          rows: { source: '$lines' },
          columns: [{ name: 'onHand', source: '$line.onHand', type: 'f64' }],
        },
      }),
      'type',
    ],
    [
      '错误码不是大写下划线形态',
      withContract({ errors: ['insufficient-inventory'] }),
      'errors',
    ],
    [
      '出现未声明的多余字段',
      withContract({ extraField: true }),
      'extraField',
    ],
    [
      '执行预算低于下限（1000）',
      withContract({ cpuBudget: 1 }),
      'cpuBudget',
    ],
    [
      '执行预算不是整数',
      withContract({ cpuBudget: 1.5 }),
      'cpuBudget',
    ],
  ])('拒绝：%s', (_label, contract, expectedPath) => {
    const result = validateAtomicContract(contract)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' | ')).toContain(expectedPath)
  })
})

describe('validateModuleManifest', () => {
  /** 真实清单：wasm-modules 准入产出的 build/manifest.json */
  const manifestPath = join(
    resolve(resolveSchemasDir(), '..'),
    'wasm-modules',
    'build',
    'manifest.json',
  )

  it('接受 wasm-modules 真实产出的准入清单', () => {
    if (!existsSync(manifestPath)) {
      // 未构建时跳过（与 wasm-modules 的软跳过策略一致）
      return
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const result = validateModuleManifest(manifest)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('拒绝缺少 staticGate 的模块条目', () => {
    const manifest = {
      generatedBy: 'test',
      modules: [
        {
          atomicType: 'available-inventory',
          file: 'available-inventory-54c7674e402c.wasm',
          tier: 'A',
          abiVersion: 1,
          sha256: '54c7674e402c268b7b3bf29cd2fb496557c836c7e82c95684db12147d13d8736',
          sizeBytes: 265,
          compiler: { name: 'rust', version: '1.95.0' },
          language: 'rust',
          reproducibleBuildRef: 'repro:rust:1.95.0:54c7',
        },
      ],
    }
    const result = validateModuleManifest(manifest)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' | ')).toContain('staticGate')
  })

  it('拒绝哈希非法的模块条目', () => {
    const manifest = {
      generatedBy: 'test',
      modules: [
        {
          atomicType: 'available-inventory',
          file: 'available-inventory-deadbeef.wasm',
          tier: 'A',
          abiVersion: 1,
          sha256: 'XYZ',
          sizeBytes: 265,
          compiler: { name: 'rust', version: '1.95.0' },
          language: 'rust',
          reproducibleBuildRef: 'ref',
          staticGate: {
            byteLength: 265,
            memoryPages: { min: 2, max: 1024 },
            exports: ['run', 'abi_version'],
            abiVersionExportKind: 'function',
            checks: ['no-start-section'],
          },
        },
      ],
    }
    const result = validateModuleManifest(manifest)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' | ')).toContain('sha256')
  })

  it('拒绝没有 run 导出的 staticGate 报告', () => {
    const manifest = {
      generatedBy: 'test',
      modules: [
        {
          atomicType: 'available-inventory',
          file: 'available-inventory-deadbeef.wasm',
          tier: 'A',
          abiVersion: 1,
          sha256: '54c7674e402c268b7b3bf29cd2fb496557c836c7e82c95684db12147d13d8736',
          sizeBytes: 265,
          compiler: { name: 'rust', version: '1.95.0' },
          language: 'rust',
          reproducibleBuildRef: 'ref',
          staticGate: {
            byteLength: 265,
            memoryPages: { min: 2, max: 1024 },
            exports: ['abi_version'],
            abiVersionExportKind: 'function',
            checks: ['no-start-section'],
          },
        },
      ],
    }
    const result = validateModuleManifest(manifest)
    expect(result.valid).toBe(false)
    // contains 约束的报错文案是通用的（不含符号名），因此断言出错路径。
    expect(result.errors.join(' | ')).toContain('staticGate.exports')
  })
})
