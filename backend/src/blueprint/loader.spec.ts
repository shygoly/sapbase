// B4 运行时可加载：加载成功 → 可执行计划；摘要漂移 / 依赖不可满足 / 实现不可指认一律拒绝。
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BlueprintCompileResult } from '@speckit/shared-schemas'
import { CompileError } from './compiler'
import { buildExecutionPlan, LoadError, loadBlueprint } from './loader'
import { BLUEPRINT_META_FILE, packBlueprint, stampCompiled, unpackBlueprint } from './packager'

/** 既有用例测完整性 / 编译 / 防漂移 / 绑定，不是授权链；显式豁免授权门。 */
const UNSIGNED = { allowUnsigned: true as const }

/** 客户同意运行的那一份 Wasm 代码的哈希（真实值由宿主重算，这里只是形状）。 */
const MODULE_SHA = 'b'.repeat(64)

const SEMANTIC = {
  entities: [
    {
      name: 'SalesOrder',
      fields: [{ name: 'total', type: 'decimal' }],
      states: [
        { name: 'draft', initial: true },
        { name: 'submitted' },
        { name: 'closed', final: true },
      ],
      transitions: [
        { from: 'draft', to: 'submitted' },
        { from: 'submitted', to: 'closed' },
      ],
    },
  ],
}

const FLOWS = {
  flows: [
    {
      id: 'SalesFlow',
      entity: 'SalesOrder',
      steps: [
        {
          id: 'checkStock',
          on: 'submitted',
          actions: [{ kind: 'check', atomic: 'available-inventory@^1.0.0' }],
        },
      ],
    },
  ],
}

function writeSourceDir(
  dependencies: Array<Record<string, string>> = [
    { atomic: 'available-inventory', version: '^1.0.0' },
  ],
): string {
  const dir = mkdtempSync(join(tmpdir(), 'speckit-bp-load-'))
  writeFileSync(
    join(dir, BLUEPRINT_META_FILE),
    JSON.stringify({
      blueprint: 'auto-parts-erp',
      version: '2026.1.0',
      runtime: '>=1.0.0 <2.0.0',
      dependencies,
    }),
  )
  writeFileSync(join(dir, 'semantic.json'), JSON.stringify(SEMANTIC))
  writeFileSync(join(dir, 'flows.json'), JSON.stringify(FLOWS))
  return dir
}

/**
 * 原子注册表替身。
 *
 * 真实的注册表是数据库读（`AtomicRegistryService.resolve`），这里只需要它返回
 * 契约 + 实现两部分 —— 加载器不关心它是怎么来的。
 */
function registry(options: { moduleSha256?: string | null; resolved?: boolean } = {}) {
  const { moduleSha256 = MODULE_SHA, resolved = true } = options
  return {
    resolve: async (atomicType: string, range: string) => {
      if (!resolved || atomicType !== 'available-inventory') {
        throw new Error(`没有满足 ${range} 的版本：${atomicType}`)
      }
      return {
        contract: { version: '1.0.0' },
        implementation: { kind: 'wasm', moduleSha256, tier: 'B' },
      }
    },
  } as never
}

describe('loadBlueprint（B4）', () => {
  let dir: string
  let pkg: string

  beforeEach(() => {
    dir = writeSourceDir()
    pkg = join(dir, 'out.erpkg')
    packBlueprint(dir, pkg)
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('合法包 → 可执行计划：原子解析到具体版本与模块哈希，动作带绑定', async () => {
    const loaded = await loadBlueprint(pkg, registry(), UNSIGNED)

    expect(loaded.plan.resolvedAtomics).toEqual([
      {
        atomic: 'available-inventory',
        requested: '^1.0.0',
        version: '1.0.0',
        implementationKind: 'wasm',
        moduleSha256: MODULE_SHA,
        tier: 'B',
      },
    ])
    expect(loaded.plan.events).toEqual([
      {
        on: 'SalesOrder.submitted',
        actions: [
          {
            kind: 'check',
            atomic: 'available-inventory@^1.0.0',
            binding: loaded.plan.resolvedAtomics[0],
          },
        ],
      },
    ])
    // 非 check 动作不绑定任何东西（它不指向原子）
    expect(loaded.ir.blueprint).toBe('auto-parts-erp')
    expect(loaded.irText).toContain('depends available-inventory@1.0.0')
  })

  it('未经编译的包（无 compiled 记录）仍可加载 —— v1 允许，但只有记录存在时才做漂移比对', async () => {
    const loaded = await loadBlueprint(pkg, registry(), UNSIGNED)
    expect(loaded.manifest.compiled).toBeUndefined()
    expect(loaded.plan.irDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('确定性：同一包重复加载得到同一 IR 摘要（否则 diff 基线不成立）', async () => {
    const first = await loadBlueprint(pkg, registry(), UNSIGNED)
    const second = await loadBlueprint(pkg, registry(), UNSIGNED)
    expect(first.plan.irDigest).toBe(second.plan.irDigest)
    expect(first.irText).toBe(second.irText)
  })

  it('compiled.irDigest 写回后，加载比对通过', async () => {
    const first = await loadBlueprint(pkg, registry(), UNSIGNED)
    stampCompiled(pkg, {
      irDigest: first.plan.irDigest,
      compiledAt: '2026-09-25T00:00:00.000Z',
    })

    const manifest = unpackBlueprint(pkg).manifest
    expect(manifest.compiled?.irDigest).toBe(first.plan.irDigest)
    // 写回只改清单，不动被哈希覆盖的文件 —— 逐文件校验和仍然成立（能解包就说明了这一点）
    expect(manifest.files['semantic.json']).toBe(unpackBlueprint(pkg).manifest.files['semantic.json'])

    const loaded = await loadBlueprint(pkg, registry(), UNSIGNED)
    expect(loaded.plan.irDigest).toBe(first.plan.irDigest)
  })

  it('记录的摘要与重编结果不符 → 拒绝（ir-drift），不返回任何计划', async () => {
    stampCompiled(pkg, {
      irDigest: `sha256:${'c'.repeat(64)}`,
      compiledAt: '2026-09-25T00:00:00.000Z',
    })

    await expect(loadBlueprint(pkg, registry(), UNSIGNED)).rejects.toMatchObject({
      name: 'LoadError',
      reason: 'ir-drift',
    })
  })

  it('原子依赖不可满足 → 编译阶段即拒（dependency-unresolved），不部分加载', async () => {
    await expect(loadBlueprint(pkg, registry({ resolved: false }), UNSIGNED)).rejects.toMatchObject({
      name: 'CompileError',
      reason: 'dependency-unresolved',
    })
  })

  it('Wasm 实现指认不出代码（无 moduleSha256）→ 拒绝（implementation-unbound）', async () => {
    await expect(
      loadBlueprint(pkg, registry({ moduleSha256: null }), UNSIGNED),
    ).rejects.toMatchObject({
      name: 'LoadError',
      reason: 'implementation-unbound',
    })
  })
})

/**
 * `unbound-atomic` 这条判定在正常路径上够不到：编译器只允许调用**清单里已声明**的原子，
 * 而绑定表就是按清单建的。所以直接对纯函数造一个"计划里有悬空动作"的输入来测 ——
 * 保留这条判定的理由是纵深防御：计划里出现一个悬空动作，等于计划本身不可执行。
 */
describe('buildExecutionPlan（悬空动作）', () => {
  const compiled: BlueprintCompileResult = {
    blueprint: 'auto-parts-erp',
    version: '2026.1.0',
    ir: {
      ir: 'blueprint-ir/v1',
      blueprint: 'auto-parts-erp',
      version: '2026.1.0',
      runtime: '>=1.0.0 <2.0.0',
      entities: [],
      events: [
        { on: 'SalesOrder.submitted', actions: [{ kind: 'check', atomic: 'not-declared@^1.0.0' }] },
      ],
      dependencies: [],
    },
    irText: '',
    irDigest: `sha256:${'d'.repeat(64)}`,
  }

  it('check 动作指向未解析的原子 → LoadError(unbound-atomic)', () => {
    expect(() => buildExecutionPlan(compiled, [])).toThrow(LoadError)
    try {
      buildExecutionPlan(compiled, [])
    } catch (error) {
      expect((error as LoadError).reason).toBe('unbound-atomic')
    }
  })

  it('非 check 动作不需要绑定', () => {
    const withApproval: BlueprintCompileResult = {
      ...compiled,
      ir: {
        ...compiled.ir,
        events: [
          {
            on: 'SalesOrder.submitted',
            actions: [{ kind: 'require-approval', rule: 'PURCHASE_HIGH_VALUE' }],
          },
        ],
      },
    }
    expect(buildExecutionPlan(withApproval, []).events[0].actions).toEqual([
      { kind: 'require-approval', rule: 'PURCHASE_HIGH_VALUE' },
    ])
  })
})

describe('依赖种类', () => {
  it('模块/蓝图依赖只登记，不做绑定（跨包解析属市场那条线）', async () => {
    const dir = writeSourceDir([
      { atomic: 'available-inventory', version: '^1.0.0' },
      { blueprint: 'base-finance', version: '^3.0.0' },
    ])
    const pkg = join(dir, 'with-blueprint-dep.erpkg')
    try {
      packBlueprint(dir, pkg)
      const loaded = await loadBlueprint(pkg, registry(), UNSIGNED)
      expect(loaded.plan.resolvedAtomics.map((binding) => binding.atomic)).toEqual([
        'available-inventory',
      ])
      expect(loaded.ir.dependencies).toEqual(['available-inventory@1.0.0', 'base-finance@^3.0.0'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('CompileError 与 LoadError 的分工', () => {
  it('编译期问题抛 CompileError，加载期问题抛 LoadError（错误类型不混用）', async () => {
    const dir = writeSourceDir()
    const pkg = join(dir, 'uncovered.erpkg')
    try {
      // 包进一个 v1 协议没覆盖的文件 → 编译器拒绝（不跳过未知文件）
      writeFileSync(join(dir, 'extra.json'), JSON.stringify({ anything: true }))
      packBlueprint(dir, pkg)
      await expect(loadBlueprint(pkg, registry(), UNSIGNED)).rejects.toMatchObject({
        name: 'CompileError',
        reason: 'uncovered-file',
      })
      await expect(loadBlueprint(pkg, registry(), UNSIGNED)).rejects.toBeInstanceOf(CompileError)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('授权链（装载器）', () => {
  it('缺 license.json 且未豁免 → license-missing，不产生计划', async () => {
    const dir = writeSourceDir()
    const pkg = join(dir, 'no-license.erpkg')
    packBlueprint(dir, pkg)
    try {
      await expect(loadBlueprint(pkg, registry())).rejects.toMatchObject({
        name: 'LoadError',
        reason: 'license-missing',
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('开发豁免：未签名包装载成功并写出 blueprint.load.unsigned', async () => {
    const dir = writeSourceDir()
    const pkg = join(dir, 'unsigned.erpkg')
    packBlueprint(dir, pkg)
    try {
      const loaded = await loadBlueprint(pkg, registry(), {
        allowUnsigned: true,
        env: { NODE_ENV: 'test' },
      })
      expect(loaded.audit).toEqual([
        { action: 'blueprint.load.unsigned', detail: { reason: 'BLUEPRINT_ALLOW_UNSIGNED' } },
      ])
      expect(loaded.plan.irDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('生产环境开启未签名豁免 → unsigned-exemption-in-production', async () => {
    const dir = writeSourceDir()
    const pkg = join(dir, 'prod.erpkg')
    packBlueprint(dir, pkg)
    try {
      await expect(
        loadBlueprint(pkg, registry(), {
          allowUnsigned: true,
          env: { NODE_ENV: 'production', BLUEPRINT_ALLOW_UNSIGNED: '1' },
        }),
      ).rejects.toMatchObject({
        name: 'LoadError',
        reason: 'unsigned-exemption-in-production',
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
