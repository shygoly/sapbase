/**
 * P0 完整模板证据：打包 → 编译通过 → irDigest 两次一致；改一处新声明 → 摘要变。
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { compileBlueprint } from './compiler'
import { packBlueprint, unpackBlueprint } from './packager'

const TEMPLATE_DIR = resolve(__dirname, '../../../templates/auto-parts')

const registry = {
  resolve: async () => ({ contract: { version: '1.0.0' } }),
} as never

describe('templates/auto-parts（P0）', () => {
  let workDir: string

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'auto-parts-'))
  })

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true })
  })

  it('打包 → 编译通过 → irDigest 两次一致；故意改一处新声明 → 摘要变', async () => {
    const pkg = join(workDir, 'auto-parts-1.1.0.erpkg')
    const manifest = packBlueprint(TEMPLATE_DIR, pkg)
    expect(manifest.blueprint).toBe('auto-parts')
    expect(manifest.version).toBe('1.1.0')

    const first = await compileBlueprint(unpackBlueprint(pkg), registry)
    const second = await compileBlueprint(unpackBlueprint(pkg), registry)
    expect(first.irDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(second.irDigest).toBe(first.irDigest)
    expect(first.ir.entities.map((entity) => entity.name)).toEqual([
      'Part',
      'Supplier',
      'Customer',
      'SalesOrder',
      'SalesOrderLine',
      'StockItem',
      'Batch',
      'Fitment',
    ])
    expect(first.ir.semantic?.count).toBe(8)
    expect(first.irText).toContain('semantic count=8 digest=')

    const unpacked = unpackBlueprint(pkg)
    const semantic = JSON.parse(unpacked.files.get('semantic.json')!.toString('utf8')) as {
      entities: Array<{ fields: Array<{ unique?: boolean; name: string }> }>
    }
    const partNo = semantic.entities[0].fields.find((field) => field.name === 'partNo')
    expect(partNo?.unique).toBe(true)
    delete partNo?.unique
    unpacked.files.set('semantic.json', Buffer.from(JSON.stringify(semantic)))
    const tweaked = await compileBlueprint(unpacked, registry)
    expect(tweaked.irDigest).not.toBe(first.irDigest)
    expect(tweaked.ir.semantic?.digest).not.toBe(first.ir.semantic?.digest)
  })
})
