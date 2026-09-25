// B2 的 HTTP 入口：打包、列举、读清单，以及失败路径。
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BlueprintController } from './blueprint.controller'
import { BlueprintService } from './blueprint.service'
import { BLUEPRINT_META_FILE } from './packager'

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
    sourceDir = writeSourceDir()
    controller = new BlueprintController(new BlueprintService())
  })

  afterEach(() => {
    delete process.env.BLUEPRINT_PACKAGES_DIR
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

  it('包目录不存在时列举返回空数组（而不是报错）', () => {
    rmSync(packagesDir, { recursive: true, force: true })
    expect(controller.list()).toEqual([])
  })
})
