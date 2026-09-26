/**
 * T3：deliver 一条命令产出可装载的签名包；先签后编会让签名失效。
 */
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { BlueprintService, DeliverError } from './blueprint.service'
import { loadBlueprint } from './loader'
import { stampCompiled, unpackBlueprint } from './packager'
import { signPackage } from './license'

const TEMPLATE_DIR = resolve(__dirname, '../../../templates')

function generatePemPair(): { publicPem: string; privatePem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }
}

const registry = {
  resolve: async () => ({
    contract: { version: '1.0.0' },
    implementation: { kind: 'wasm', moduleSha256: 'b'.repeat(64), tier: 'B' },
  }),
} as never

describe('BlueprintService.deliver', () => {
  let packagesDir: string
  let keys: { publicPem: string; privatePem: string }
  let savedPrivate: string | undefined
  let service: BlueprintService

  beforeEach(() => {
    packagesDir = mkdtempSync(join(tmpdir(), 'bp-deliver-'))
    keys = generatePemPair()
    savedPrivate = process.env.BLUEPRINT_LICENSE_PRIVATE_KEY
    process.env.BLUEPRINT_PACKAGES_DIR = packagesDir
    process.env.BLUEPRINT_TEMPLATES_DIR = TEMPLATE_DIR
    process.env.BLUEPRINT_LICENSE_PRIVATE_KEY = keys.privatePem
    service = new BlueprintService(registry)
  })

  afterEach(() => {
    delete process.env.BLUEPRINT_PACKAGES_DIR
    delete process.env.BLUEPRINT_TEMPLATES_DIR
    if (savedPrivate === undefined) delete process.env.BLUEPRINT_LICENSE_PRIVATE_KEY
    else process.env.BLUEPRINT_LICENSE_PRIVATE_KEY = savedPrivate
    rmSync(packagesDir, { recursive: true, force: true })
  })

  it('一条命令产出可被 loadBlueprint 装载的包（含 compiled.irDigest 与 signature）', async () => {
    const delivered = await service.deliver('auto-parts-min', {
      grantedTo: ['org-a', 'org-b'],
      resell: false,
      issuer: 'sapbase-platform',
    })
    expect(delivered.id).toBe('auto-parts-min-1.0.0')
    expect(delivered.manifest.compiled?.irDigest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(delivered.manifest.signature).toBeDefined()

    const loaded = await loadBlueprint(delivered.packagePath, registry, {
      tenantId: 'org-b',
      env: { BLUEPRINT_LICENSE_PUBLIC_KEYS: JSON.stringify([keys.publicPem]) },
    })
    expect(loaded.plan.irDigest).toBe(delivered.manifest.compiled?.irDigest)
    expect(loaded.license?.grantedTo).toEqual(['org-a', 'org-b'])
  })

  it('未配置私钥 → 拒绝，不产出未签名制品', async () => {
    delete process.env.BLUEPRINT_LICENSE_PRIVATE_KEY
    const bare = new BlueprintService(registry)
    await expect(
      bare.deliver('auto-parts-min', { grantedTo: ['org-b'] }),
    ).rejects.toBeInstanceOf(DeliverError)
    await expect(
      bare.deliver('auto-parts-min', { grantedTo: ['org-b'] }),
    ).rejects.toMatchObject({ reason: 'missing-private-key' })
  })

  it('未知模板 → missing-template', async () => {
    await expect(
      service.deliver('does-not-exist', { grantedTo: ['org-b'] }),
    ).rejects.toMatchObject({ reason: 'missing-template' })
  })

  it('先签后编 → 签名失效，装载被拒', async () => {
    // 顺序颠倒：pack → sign → stampCompiled。compiled 变了但签名仍覆盖旧清单。
    const { packBlueprint } = await import('./packager')
    const { cpSync, writeFileSync } = await import('node:fs')
    const staging = mkdtempSync(join(tmpdir(), 'bp-wrong-order-'))
    try {
      cpSync(join(TEMPLATE_DIR, 'auto-parts-min'), staging, { recursive: true })
      writeFileSync(
        join(staging, 'license.json'),
        JSON.stringify({
          license: 'blueprint-license/v1',
          grantedTo: ['org-b'],
          resell: false,
          issuer: 'sapbase-platform',
        }),
      )
      const pkg = join(packagesDir, 'wrong-order.erpkg')
      packBlueprint(staging, pkg)
      signPackage(pkg, keys.privatePem)
      const compiled = await (await import('./compiler')).compileBlueprint(
        unpackBlueprint(pkg),
        registry,
      )
      stampCompiled(pkg, { irDigest: compiled.irDigest, compiledAt: new Date().toISOString() })
      await expect(
        loadBlueprint(pkg, registry, {
          tenantId: 'org-b',
          env: { BLUEPRINT_LICENSE_PUBLIC_KEYS: JSON.stringify([keys.publicPem]) },
        }),
      ).rejects.toMatchObject({ name: 'LoadError', reason: 'signature-invalid' })
    } finally {
      rmSync(staging, { recursive: true, force: true })
    }
  })
})
