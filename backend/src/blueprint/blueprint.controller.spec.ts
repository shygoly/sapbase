// B2/B4 的 HTTP 入口：打包、列举、读清单、编译（可写回编译记录）、加载，以及失败路径。
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BlueprintController } from './blueprint.controller'
import { BlueprintService } from './blueprint.service'
import { BLUEPRINT_META_FILE, stampCompiled, unpackBlueprint } from './packager'

/** 编译与加载路径只用到 resolve；这里给一个能解析 available-inventory 的替身。 */
const registryStub = {
  resolve: async () => ({
    contract: { version: '1.0.0' },
    implementation: { kind: 'wasm', moduleSha256: 'b'.repeat(64), tier: 'B' },
  }),
} as never

function writeSourceDir(name = 'auto-parts-erp'): string {
  const dir = mkdtempSync(join(tmpdir(), 'speckit-bp-src-'))
  writeFileSync(
    join(dir, BLUEPRINT_META_FILE),
    JSON.stringify({
      blueprint: name,
      version: '2026.1.0',
      runtime: '>=1.0.0 <2.0.0',
      dependencies: [{ atomic: 'available-inventory', version: '^1.0.0' }],
    }),
  )
  writeFileSync(join(dir, 'semantic.json'), JSON.stringify({ entities: [] }))
  return dir
}

describe('BlueprintController（B2）', () => {
  let packagesDir: string
  let sourceDir: string
  let controller: BlueprintController

  beforeEach(() => {
    packagesDir = mkdtempSync(join(tmpdir(), 'speckit-bp-pkgs-'))
    process.env.BLUEPRINT_PACKAGES_DIR = packagesDir
    process.env.BLUEPRINT_ALLOW_UNSIGNED = '1'
    sourceDir = writeSourceDir()
    controller = new BlueprintController(new BlueprintService(registryStub))
  })

  afterEach(() => {
    delete process.env.BLUEPRINT_PACKAGES_DIR
    delete process.env.BLUEPRINT_ALLOW_UNSIGNED
    rmSync(packagesDir, { recursive: true, force: true })
    rmSync(sourceDir, { recursive: true, force: true })
  })

  it('打包 → 落进包目录 → 可列举 → 可读清单', () => {
    const packaged = controller.package({ dir: sourceDir })
    expect(packaged.manifest.blueprint).toBe('auto-parts-erp')
    expect(existsSync(packaged.packagePath)).toBe(true)

    const listed = controller.list()
    expect(listed.map((entry) => entry.id)).toEqual(['auto-parts-erp-2026.1.0'])

    const manifest = controller.manifest('auto-parts-erp-2026.1.0')
    expect(manifest.dependencies).toEqual([
      { atomic: 'available-inventory', version: '^1.0.0' },
    ])
  })

  it('缺 dir → 400', () => {
    expect(() => controller.package({})).toThrow(BadRequestException)
  })

  it('目录不可用 → 400 且带可定位原因', () => {
    try {
      controller.package({ dir: '/nonexistent/blueprint' })
      throw new Error('本应被拒')
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException)
      expect((error as Error).message).toContain('打包失败[io]')
    }
  })

  it('未知包 id → 404', () => {
    expect(() => controller.manifest('does-not-exist')).toThrow(NotFoundException)
  })

  it('编译：语义文件被 v1 协议覆盖时能编出 IR', async () => {
    // 源目录里只放了语义骨架，缺 semantic.json 的必需结构 → 编译应报 schema-invalid
    writeFileSync(
      join(sourceDir, 'semantic.json'),
      JSON.stringify({
        entities: [
          {
            name: 'Customer',
            fields: [{ name: 'name', type: 'text' }],
            states: [{ name: 'active', initial: true }, { name: 'archived', final: true }],
            transitions: [{ from: 'active', to: 'archived' }],
          },
        ],
      }),
    )
    controller.package({ dir: sourceDir })
    const result = await controller.compile('auto-parts-erp-2026.1.0')
    expect(result.ir.entities.map((entity) => entity.name)).toEqual(['Customer'])
    expect(result.ir.dependencies).toEqual(['available-inventory@1.0.0'])
  })

  it('编译失败 → 400 且带冲突明细', async () => {
    // semantic.json 里放一个从初始态不可达的状态 → 状态机非法
    writeFileSync(
      join(sourceDir, 'semantic.json'),
      JSON.stringify({
        entities: [
          {
            name: 'Customer',
            fields: [{ name: 'name', type: 'text' }],
            states: [
              { name: 'active', initial: true },
              { name: 'orphan' },
              { name: 'archived', final: true },
            ],
            transitions: [{ from: 'active', to: 'archived' }],
          },
        ],
      }),
    )
    controller.package({ dir: sourceDir })
    await expect(controller.compile('auto-parts-erp-2026.1.0')).rejects.toMatchObject({
      response: { reason: 'conflict' },
    })
  })

  it('包目录不存在时列举返回空数组（而不是报错）', () => {
    rmSync(packagesDir, { recursive: true, force: true })
    expect(controller.list()).toEqual([])
  })

  it('加载：合法包 → 可执行计划（原子绑定 + IR）', async () => {
    writeFileSync(
      join(sourceDir, 'semantic.json'),
      JSON.stringify({
        entities: [
          {
            name: 'Customer',
            fields: [{ name: 'name', type: 'text' }],
            states: [{ name: 'active', initial: true }, { name: 'archived', final: true }],
            transitions: [{ from: 'active', to: 'archived' }],
          },
        ],
      }),
    )
    controller.package({ dir: sourceDir })
    const loaded = await controller.load('auto-parts-erp-2026.1.0')

    expect(loaded.plan.resolvedAtomics.map((binding) => binding.atomic)).toEqual([
      'available-inventory',
    ])
    expect(loaded.plan.irDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('编译时写回编译记录（stamp）→ 清单里出现 compiled.irDigest', async () => {
    writeFileSync(
      join(sourceDir, 'semantic.json'),
      JSON.stringify({
        entities: [
          {
            name: 'Customer',
            fields: [{ name: 'name', type: 'text' }],
            states: [{ name: 'active', initial: true }, { name: 'archived', final: true }],
            transitions: [{ from: 'active', to: 'archived' }],
          },
        ],
      }),
    )
    controller.package({ dir: sourceDir })

    const plain = await controller.compile('auto-parts-erp-2026.1.0')
    expect(plain.stamped).toBe(false)
    expect(controller.manifest('auto-parts-erp-2026.1.0').compiled).toBeUndefined()

    const stamped = await controller.compile('auto-parts-erp-2026.1.0', { stamp: true })
    expect(stamped.stamped).toBe(true)
    expect(controller.manifest('auto-parts-erp-2026.1.0').compiled?.irDigest).toBe(
      stamped.irDigest,
    )
    // 写回记录后加载仍然成功（摘要自洽）
    await expect(controller.load('auto-parts-erp-2026.1.0')).resolves.toBeDefined()
  })

  it('deliver 请求含未知字段 → 400', async () => {
    await expect(
      controller.deliver('auto-parts-min', { grantedTo: ['org-b'], extra: true }),
    ).rejects.toMatchObject({
      response: { reason: 'unknown-field' },
    })
  })

  it('加载失败 → 400 且带原因（ir-drift）', async () => {
    writeFileSync(
      join(sourceDir, 'semantic.json'),
      JSON.stringify({
        entities: [
          {
            name: 'Customer',
            fields: [{ name: 'name', type: 'text' }],
            states: [{ name: 'active', initial: true }, { name: 'archived', final: true }],
            transitions: [{ from: 'active', to: 'archived' }],
          },
        ],
      }),
    )
    const packaged = controller.package({ dir: sourceDir })
    stampCompiled(packaged.packagePath, {
      irDigest: `sha256:${'c'.repeat(64)}`,
      compiledAt: '2026-09-25T00:00:00.000Z',
    })
    // 记录确实写进去了（否则这条测试会变成"因为没记录所以跳过比对"而假通过）
    expect(unpackBlueprint(packaged.packagePath).manifest.compiled?.irDigest).toBe(
      `sha256:${'c'.repeat(64)}`,
    )

    await expect(controller.load('auto-parts-erp-2026.1.0')).rejects.toMatchObject({
      response: { reason: 'ir-drift' },
    })
  })
})
