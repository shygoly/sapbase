// 授权签名：现场生成 Ed25519 密钥，私钥不进快照。
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BlueprintManifest } from '@speckit/shared-schemas'
import {
  signManifest,
  signPackage,
  verifyAgainstTrustRoots,
  verifySignature,
} from './license'
import { loadBlueprint } from './loader'
import { BLUEPRINT_META_FILE, packBlueprint, stampCompiled, unpackBlueprint } from './packager'

function generatePemPair(): { publicPem: string; privatePem: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }
}

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

const LICENSE = {
  license: 'blueprint-license/v1',
  grantedTo: ['org-2222'],
  resell: false,
  expiresAt: '2027-09-25T00:00:00Z',
  issuer: 'sapbase-platform',
}

function writeSignedSource(license: Record<string, unknown> = LICENSE): string {
  const dir = mkdtempSync(join(tmpdir(), 'speckit-bp-lic-'))
  writeFileSync(
    join(dir, BLUEPRINT_META_FILE),
    JSON.stringify({
      blueprint: 'auto-parts-erp',
      version: '2026.1.0',
      runtime: '>=1.0.0 <2.0.0',
      dependencies: [{ atomic: 'available-inventory', version: '^1.0.0' }],
    }),
  )
  writeFileSync(join(dir, 'semantic.json'), JSON.stringify(SEMANTIC))
  writeFileSync(join(dir, 'license.json'), JSON.stringify(license))
  return dir
}

const registry = {
  resolve: async () => ({
    contract: { version: '1.0.0' },
    implementation: { kind: 'wasm', moduleSha256: 'b'.repeat(64), tier: 'B' },
  }),
} as never

async function packSign(
  dir: string,
  keys: { publicPem: string; privatePem: string },
): Promise<string> {
  const pkg = join(dir, 'signed.erpkg')
  packBlueprint(dir, pkg)
  const loaded = await loadBlueprint(pkg, registry, { allowUnsigned: true })
  stampCompiled(pkg, { irDigest: loaded.plan.irDigest, compiledAt: '2026-09-25T00:00:00.000Z' })
  signPackage(pkg, keys.privatePem)
  return pkg
}

describe('signManifest / verifySignature', () => {
  it('正例：签名可被对应公钥验证', () => {
    const keys = generatePemPair()
    const manifest: BlueprintManifest = {
      blueprint: 'auto-parts-erp',
      version: '1.0.0',
      runtime: '>=1.0.0',
      layers: { public: ['semantic.json'] },
      files: { 'semantic.json': `sha256:${'a'.repeat(64)}` },
    }
    const signature = signManifest(manifest, keys.privatePem)
    expect(verifySignature(manifest, signature, keys.publicPem)).toBe(true)
  })

  it('负例：改清单任一字段后验签失败', () => {
    const keys = generatePemPair()
    const manifest: BlueprintManifest = {
      blueprint: 'auto-parts-erp',
      version: '1.0.0',
      runtime: '>=1.0.0',
      layers: { public: ['semantic.json'] },
      files: { 'semantic.json': `sha256:${'a'.repeat(64)}` },
    }
    const signature = signManifest(manifest, keys.privatePem)
    const tampered = { ...manifest, version: '1.0.1' }
    expect(verifySignature(tampered, signature, keys.publicPem)).toBe(false)
  })

  it('负例：信任根未配置 → 验签失败（fail-closed）', () => {
    const keys = generatePemPair()
    const manifest: BlueprintManifest = {
      blueprint: 'auto-parts-erp',
      version: '1.0.0',
      runtime: '>=1.0.0',
      layers: { public: ['semantic.json'] },
      files: { 'semantic.json': `sha256:${'a'.repeat(64)}` },
    }
    const signature = signManifest(manifest, keys.privatePem)
    expect(verifyAgainstTrustRoots(manifest, signature, {})).toBe(false)
  })
})

describe('装载授权链（签名包）', () => {
  it('授权范围内的租户 → 装载成功，审计记录授权结果', async () => {
    const keys = generatePemPair()
    const dir = writeSignedSource()
    try {
      const pkg = await packSign(dir, keys)
      const loaded = await loadBlueprint(pkg, registry, {
        tenantId: 'org-2222',
        env: { BLUEPRINT_LICENSE_PUBLIC_KEYS: JSON.stringify([keys.publicPem]) },
      })
      expect(loaded.plan.blueprint).toBe('auto-parts-erp')
      expect(loaded.license?.grantedTo).toEqual(['org-2222'])
      expect(loaded.license?.resell).toBe(false)
      expect(loaded.audit).toEqual([
        expect.objectContaining({
          action: 'blueprint.load.authorized',
          detail: expect.objectContaining({ tenantId: 'org-2222', grantedTo: ['org-2222'] }),
        }),
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('未授权租户 → unauthorized，不产生可执行计划', async () => {
    const keys = generatePemPair()
    const dir = writeSignedSource()
    try {
      const pkg = await packSign(dir, keys)
      await expect(
        loadBlueprint(pkg, registry, {
          tenantId: 'org-3333',
          env: { BLUEPRINT_LICENSE_PUBLIC_KEYS: JSON.stringify([keys.publicPem]) },
        }),
      ).rejects.toMatchObject({ name: 'LoadError', reason: 'unauthorized' })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('改 grantedTo 并更新 files 哈希但不重签 → signature-invalid', async () => {
    const keys = generatePemPair()
    const dir = writeSignedSource()
    try {
      const pkg = await packSign(dir, keys)
      const AdmZip = (await import('adm-zip')).default
      const zip = new AdmZip(pkg)
      const nextLicense = { ...LICENSE, grantedTo: ['org-3333'] }
      zip.updateFile('license.json', Buffer.from(JSON.stringify(nextLicense)))
      const entry = zip.getEntry('manifest.json')
      if (!entry) throw new Error('测试夹具损坏：缺 manifest.json')
      const manifest = JSON.parse(entry.getData().toString()) as BlueprintManifest
      const { createHash } = await import('node:crypto')
      manifest.files['license.json'] =
        `sha256:${createHash('sha256').update(JSON.stringify(nextLicense)).digest('hex')}`
      zip.updateFile('manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`))
      zip.writeZip(pkg)

      await expect(
        loadBlueprint(pkg, registry, {
          tenantId: 'org-3333',
          env: { BLUEPRINT_LICENSE_PUBLIC_KEYS: JSON.stringify([keys.publicPem]) },
        }),
      ).rejects.toMatchObject({ name: 'LoadError', reason: 'signature-invalid' })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('expiresAt 已过 → license-expired', async () => {
    const keys = generatePemPair()
    const dir = writeSignedSource({ ...LICENSE, expiresAt: '2020-01-01T00:00:00Z' })
    try {
      const pkg = await packSign(dir, keys)
      await expect(
        loadBlueprint(pkg, registry, {
          tenantId: 'org-2222',
          now: new Date('2026-09-25T00:00:00Z'),
          env: { BLUEPRINT_LICENSE_PUBLIC_KEYS: JSON.stringify([keys.publicPem]) },
        }),
      ).rejects.toMatchObject({ name: 'LoadError', reason: 'license-expired' })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('license.signature 与 manifest.signature 不一致 → 拒', async () => {
    const keys = generatePemPair()
    const dir = writeSignedSource({ ...LICENSE, signature: 'not-the-manifest-sig' })
    try {
      const pkg = await packSign(dir, keys)
      expect(unpackBlueprint(pkg).manifest.signature).toBeDefined()
      await expect(
        loadBlueprint(pkg, registry, {
          tenantId: 'org-2222',
          env: { BLUEPRINT_LICENSE_PUBLIC_KEYS: JSON.stringify([keys.publicPem]) },
        }),
      ).rejects.toMatchObject({ name: 'LoadError', reason: 'signature-invalid' })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
