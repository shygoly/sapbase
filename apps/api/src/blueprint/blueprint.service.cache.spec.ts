import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BlueprintService } from './blueprint.service'
import { BLUEPRINT_META_FILE, packBlueprint } from './packager'

const registry = {
  resolve: async () => ({
    contract: { version: '1.0.0' },
    implementation: { kind: 'wasm', moduleSha256: 'b'.repeat(64), tier: 'B' },
  }),
} as never

function writePackage(dir: string, blueprint: string, version: string): string {
  const source = join(dir, `source-${blueprint}-${version}`)
  mkdirSync(source, { recursive: true })
  writeFileSync(
    join(source, BLUEPRINT_META_FILE),
    JSON.stringify({
      blueprint,
      version,
      runtime: '>=1.0.0 <2.0.0',
      dependencies: [{ atomic: 'available-inventory', version: '^1.0.0' }],
    }),
  )
  writeFileSync(
    join(source, 'semantic.json'),
    JSON.stringify({
      entities: [
        {
          name: 'Order',
          fields: [{ name: 'status', type: 'text', indexed: true }],
          states: [
            { name: 'draft', initial: true },
            { name: 'done', final: true },
          ],
          transitions: [{ from: 'draft', to: 'done' }],
        },
      ],
    }),
  )
  const pkg = join(dir, `${blueprint}-${version}.erpkg`)
  packBlueprint(source, pkg)
  return pkg
}

describe('BlueprintService runtime cache', () => {
  let packagesDir: string
  let savedAllowUnsigned: string | undefined
  let savedTtl: string | undefined

  beforeEach(() => {
    packagesDir = mkdtempSync(join(tmpdir(), 'bp-cache-'))
    savedAllowUnsigned = process.env.BLUEPRINT_ALLOW_UNSIGNED
    savedTtl = process.env.BLUEPRINT_CACHE_TTL_MS
    process.env.BLUEPRINT_PACKAGES_DIR = packagesDir
    process.env.BLUEPRINT_ALLOW_UNSIGNED = 'true'
    process.env.BLUEPRINT_CACHE_TTL_MS = '60000'
  })

  afterEach(() => {
    delete process.env.BLUEPRINT_PACKAGES_DIR
    if (savedAllowUnsigned === undefined) delete process.env.BLUEPRINT_ALLOW_UNSIGNED
    else process.env.BLUEPRINT_ALLOW_UNSIGNED = savedAllowUnsigned
    if (savedTtl === undefined) delete process.env.BLUEPRINT_CACHE_TTL_MS
    else process.env.BLUEPRINT_CACHE_TTL_MS = savedTtl
    rmSync(packagesDir, { recursive: true, force: true })
  })

  it('returns the same loaded instance on a cache hit', async () => {
    writePackage(packagesDir, 'cache-demo', '1.0.0')
    const service = new BlueprintService(registry)

    const first = await service.load('cache-demo-1.0.0', { tenantId: 'org-a' })
    const second = await service.load('cache-demo-1.0.0', { tenantId: 'org-a' })

    expect(second).toBe(first)
    expect(service.compiledTemplate('cache-demo-1.0.0')).toBe(first.compiled.template)
  })

  it('does not share a tenant-specific entry across tenants', async () => {
    writePackage(packagesDir, 'cache-demo', '1.0.0')
    const service = new BlueprintService(registry)

    const first = await service.load('cache-demo-1.0.0', { tenantId: 'org-a' })
    const second = await service.load('cache-demo-1.0.0', { tenantId: 'org-b' })

    expect(second).not.toBe(first)
  })

  it('invalidate() forces a fresh load', async () => {
    writePackage(packagesDir, 'cache-demo', '1.0.0')
    const service = new BlueprintService(registry)

    const first = await service.load('cache-demo-1.0.0', { tenantId: 'org-a' })
    service.invalidate('cache-demo-1.0.0')
    const second = await service.load('cache-demo-1.0.0', { tenantId: 'org-a' })

    expect(second).not.toBe(first)
  })
})
