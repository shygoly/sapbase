// 模块发布前的原子依赖校验（元语不变量 4：依赖不满足就不许发布）
// 与「模块记录 → 最小蓝图包」的导出。
import { BadRequestException } from '@nestjs/common'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BlueprintExportError } from './blueprint-export'
import { ModuleRegistryService } from './module-registry.service'

type ResolveFn = (atomicType: string, range: string) => Promise<unknown>

function build(resolve: ResolveFn) {
  const calls: Array<[string, string]> = []
  const service = new ModuleRegistryService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      resolve: async (atomicType: string, range: string) => {
        calls.push([atomicType, range])
        return resolve(atomicType, range)
      },
    } as never,
    {} as never,
  )
  return { service, calls }
}

describe('assertAtomicDependencies', () => {
  it('没有依赖 → 直接通过，不去解析', async () => {
    const { service, calls } = build(async () => ({}))
    await expect(service.assertAtomicDependencies([])).resolves.toBeUndefined()
    expect(calls).toEqual([])
  })

  it('依赖可解析 → 通过，且 type/range 切分正确', async () => {
    const { service, calls } = build(async () => ({}))
    await expect(
      service.assertAtomicDependencies(['available-inventory@^1.0.0']),
    ).resolves.toBeUndefined()
    expect(calls).toEqual([['available-inventory', '^1.0.0']])
  })

  it('依赖不可用 → 拒绝，并**一次列出全部**缺失项（不是遇到第一条就停）', async () => {
    const { service, calls } = build(async (atomicType: string) => {
      if (atomicType === 'available-inventory') return {}
      throw new Error(`没有 active 的契约：${atomicType}`)
    })

    let thrown: unknown
    try {
      await service.assertAtomicDependencies([
        'available-inventory@^1.0.0',
        'post-inventory-movement@^2.0.0',
        'calculate-mrp@^1.0.0',
      ])
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(BadRequestException)
    const message = (thrown as Error).message
    expect(message).toContain('post-inventory-movement@^2.0.0')
    expect(message).toContain('calculate-mrp@^1.0.0')
    // 三条都试过：第一条成功的没有造成提前返回
    expect(calls).toHaveLength(3)
  })

  it('格式非法（缺 @ 或范围为空）→ 以明确原因拒绝', async () => {
    const { service } = build(async () => ({}))
    await expect(
      service.assertAtomicDependencies(['available-inventory']),
    ).rejects.toThrow(/格式应为 atomicType@range/)
    await expect(
      service.assertAtomicDependencies(['available-inventory@']),
    ).rejects.toThrow(/格式应为 atomicType@range/)
  })
})

describe('exportBlueprint（模块记录 → 最小蓝图包）', () => {
  /** 造一个只够导出用的模块记录（导出只用 findOne 的返回值）。 */
  function moduleRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: 'module-1',
      name: 'Auto Parts ERP',
      version: '1.0.0',
      dependsOnAtomics: ['available-inventory@^1.0.0'],
      metadata: { entities: ['SalesOrder'] },
      capabilities: [{ entity: 'Customer' }],
      ...overrides,
    }
  }

  function harness(
    record: unknown,
    resolve: (atomicType: string, range: string) => Promise<unknown> = async () => ({}),
  ) {
    const packagedDirs: string[] = []
    const service = new ModuleRegistryService(
      { findOne: async () => record } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { resolve } as never,
      {
        packageFrom: (dir: string) => {
          packagedDirs.push(dir)
          return {
            manifest: {
              blueprint: 'auto-parts-erp',
              version: '1.0.0',
              runtime: '>=1.0.0 <2.0.0',
              layers: { public: ['semantic.json'] },
              files: { 'semantic.json': `sha256:${'a'.repeat(64)}` },
            },
            packagePath: join(dir, 'auto-parts-erp-1.0.0.erpkg'),
          }
        },
      } as never,
    )
    return { service, packagedDirs }
  }

  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'speckit-bp-export-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('导出骨架：实体名合并去重，原子依赖逐条解析，交给打包器', async () => {
    const calls: Array<[string, string]> = []
    const { service, packagedDirs } = harness(moduleRecord(), async (atomicType, range) => {
      calls.push([atomicType, range])
      return {}
    })

    const result = await service.exportBlueprint('module-1', 'org-1', { dir })

    // 依赖先解析（与发布同一判据），再打包
    expect(calls).toEqual([['available-inventory', '^1.0.0']])
    expect(packagedDirs).toEqual([dir])
    expect(result.dropped).toEqual([])

    const meta = JSON.parse(readFileSync(join(dir, 'blueprint.json'), 'utf8'))
    expect(meta).toEqual({
      blueprint: 'auto-parts-erp',
      version: '1.0.0',
      runtime: '>=1.0.0 <2.0.0',
      dependencies: [{ atomic: 'available-inventory', version: '^1.0.0' }],
    })

    const semantic = JSON.parse(readFileSync(join(dir, 'semantic.json'), 'utf8'))
    expect(semantic.entities.map((entity: { name: string }) => entity.name)).toEqual([
      'SalesOrder',
      'Customer',
    ])
  })

  it('原子依赖不可解析 → 拒绝导出（不交付"编译必然失败"的包）', async () => {
    const { service, packagedDirs } = harness(moduleRecord(), async () => {
      throw new Error('没有 active 的契约：available-inventory')
    })
    await expect(service.exportBlueprint('module-1', 'org-1', { dir })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(packagedDirs).toEqual([])
  })

  it('不合命名约定的实体名 → 不静默丢弃，逐条写进 dropped', async () => {
    const { service } = harness(
      moduleRecord({ metadata: { entities: ['SalesOrder', 'sales_order'] } }),
    )
    const result = await service.exportBlueprint('module-1', 'org-1', { dir })
    expect(result.dropped).toEqual([
      { name: 'sales_order', reason: '不满足实体命名约定（需形如 SalesOrder）' },
    ])
    const semantic = JSON.parse(readFileSync(join(dir, 'semantic.json'), 'utf8'))
    expect(semantic.entities.map((entity: { name: string }) => entity.name)).toEqual([
      'SalesOrder',
      'Customer',
    ])
  })

  it('没有可导出实体 → 拒绝（no-entities）', async () => {
    const { service } = harness(
      moduleRecord({ metadata: {}, capabilities: [{ entity: null }] }),
    )
    await expect(service.exportBlueprint('module-1', 'org-1', { dir })).rejects.toMatchObject({
      name: 'BlueprintExportError',
      reason: 'no-entities',
    })
  })

  it('版本不是语义化版本 → 拒绝（invalid-version），且不落盘', async () => {
    const { service } = harness(moduleRecord({ version: 'v1' }))
    await expect(service.exportBlueprint('module-1', 'org-1', { dir })).rejects.toBeInstanceOf(
      BlueprintExportError,
    )
  })
})
