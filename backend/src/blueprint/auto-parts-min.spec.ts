/**
 * T1 证据：真实模板打包 → 编译通过 → irDigest 两次一致；改一处 → 摘要变。
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { compileBlueprint } from './compiler'
import { packBlueprint, unpackBlueprint } from './packager'

const TEMPLATE_DIR = resolve(__dirname, '../../../templates/auto-parts-min')

const registry = {
  resolve: async () => ({ contract: { version: '1.0.0' } }),
} as never

describe('templates/auto-parts-min（T1）', () => {
  let workDir: string

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'auto-parts-min-'))
  })

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true })
  })

  it('打包 → 编译通过 → irDigest 两次一致；故意改一处 → 摘要变', async () => {
    const pkg = join(workDir, 'auto-parts-min-1.0.0.erpkg')
    const manifest = packBlueprint(TEMPLATE_DIR, pkg)
    expect(manifest.blueprint).toBe('auto-parts-min')
    expect(manifest.version).toBe('1.0.0')

    const first = await compileBlueprint(unpackBlueprint(pkg), registry)
    const second = await compileBlueprint(unpackBlueprint(pkg), registry)
    expect(first.irDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(second.irDigest).toBe(first.irDigest)
    expect(first.ir.entities.map((entity) => entity.name)).toEqual([
      'Part',
      'Supplier',
      'Customer',
      'SalesOrder',
      'StockItem',
    ])
    expect(first.ir.events.map((event) => event.on)).toEqual([
      'SalesOrder.draft',
      'SalesOrder.confirmed',
      'SalesOrder.shipped',
      'SalesOrder.closed',
    ])

    const unpacked = unpackBlueprint(pkg)
    const rules = JSON.parse(unpacked.files.get('rules.json')!.toString('utf8')) as {
      validation: Array<{ value?: unknown }>
    }
    rules.validation[0].value = 2
    unpacked.files.set('rules.json', Buffer.from(JSON.stringify(rules)))
    const tweaked = await compileBlueprint(unpacked, registry)
    expect(tweaked.irDigest).not.toBe(first.irDigest)
  })
})
