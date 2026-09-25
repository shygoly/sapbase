// B2 打包与解包：往返等价、篡改/缺失/多余被拒、路径穿越被拒、分层推导正确。
import AdmZip from 'adm-zip'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BLUEPRINT_MANIFEST_FILE,
  BLUEPRINT_META_FILE,
  PackageError,
  assertSafeEntryName,
  layerOf,
  packBlueprint,
  readManifestFromPackage,
  unpackBlueprint,
} from './packager'

/** 造一个最小蓝图目录。 */
function writeSourceDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'speckit-blueprint-'))
  mkdirSync(join(dir, 'config'), { recursive: true })
  mkdirSync(join(dir, 'protected'), { recursive: true })
  writeFileSync(
    join(dir, BLUEPRINT_META_FILE),
    JSON.stringify({
      blueprint: 'auto-parts-erp',
      version: '2026.1.0',
      runtime: '>=1.0.0 <2.0.0',
      dependencies: [{ atomic: 'available-inventory', version: '^1.0.0' }],
      license: { required: true, server: null },
    }),
  )
  writeFileSync(join(dir, 'semantic.json'), JSON.stringify({ entities: ['Customer'] }))
  writeFileSync(join(dir, 'config', 'thresholds.json'), JSON.stringify({ poApproval: 100000 }))
  writeFileSync(join(dir, 'protected', 'rules.enc'), 'placeholder-not-encrypted')
  return dir
}

describe('layerOf（分层按路径约定推导）', () => {
  it.each([
    ['config/thresholds.json', 'configurable'],
    ['protected/rules.enc', 'protected'],
    ['semantic.json', 'public'],
    ['nested/dir/forms.json', 'public'],
  ])('%s → %s', (path, expected) => {
    expect(layerOf(path)).toBe(expected)
  })
})

describe('packBlueprint + unpackBlueprint', () => {
  let dir: string
  let pkg: string

  beforeEach(() => {
    dir = writeSourceDir()
    pkg = join(dir, 'out.erpkg')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('打包→解包往返等价，且清单由打包器生成并通过协议校验', () => {
    const manifest = packBlueprint(dir, pkg)

    // 元数据与旧清单不进包
    expect(Object.keys(manifest.files).sort()).toEqual([
      'config/thresholds.json',
      'protected/rules.enc',
      'semantic.json',
    ])
    expect(manifest.layers.public).toEqual(['semantic.json'])
    expect(manifest.layers.configurable).toEqual(['config/thresholds.json'])
    expect(manifest.layers.protected).toEqual(['protected/rules.enc'])

    const unpacked = unpackBlueprint(pkg)
    expect(unpacked.manifest).toEqual(manifest)
    expect(
      unpacked.files.get('config/thresholds.json')?.toString('utf8'),
    ).toBe(readFileSync(join(dir, 'config', 'thresholds.json'), 'utf8'))
  })

  it.each([
    '../evil.json',
    'a/../../evil.json',
    '/etc/passwd',
    'a/../../../x.json',
    '..',
    'C:evil.json',
  ])('拒绝可疑条目名：%s', (name) => {
    expect(() => assertSafeEntryName(name)).toThrow(PackageError)
    try {
      assertSafeEntryName(name)
    } catch (error) {
      expect((error as PackageError).reason).toBe('path-traversal')
    }
  })

  it('正常条目名被规范化后放行', () => {
    expect(assertSafeEntryName('a/b.json')).toBe('a/b.json')
    expect(assertSafeEntryName('./a/b.json')).toBe('a/b.json')
  })

  it('解包绝不落盘：只返回内存中的文件', () => {
    packBlueprint(dir, pkg)
    const unpacked = unpackBlueprint(pkg)
    // 目标目录里不应出现包内内容之外的新文件（解包不写盘）
    expect(unpacked.files.size).toBe(Object.keys(unpacked.manifest.files).length + 1)
  })

  it('缺少清单被拒', () => {
    const noManifest = new AdmZip()
    noManifest.addFile('semantic.json', Buffer.from('{}'))
    const path = join(dir, 'no-manifest.erpkg')
    noManifest.writeZip(path)

    expect(() => unpackBlueprint(path)).toThrow(/缺少 manifest\.json/)
  })

  it('文件被篡改（清单未变）被拒', () => {
    const manifest = packBlueprint(dir, pkg)
    const tampered = new AdmZip()
    tampered.addFile(BLUEPRINT_MANIFEST_FILE, Buffer.from(JSON.stringify(manifest)))
    tampered.addFile('semantic.json', Buffer.from('{"entities":["Hacked"]}'))
    tampered.addFile(
      'config/thresholds.json',
      readFileSync(join(dir, 'config', 'thresholds.json')),
    )
    tampered.addFile('protected/rules.enc', readFileSync(join(dir, 'protected', 'rules.enc')))
    const path = join(dir, 'tampered.erpkg')
    tampered.writeZip(path)

    try {
      unpackBlueprint(path)
      throw new Error('本应被拒')
    } catch (error) {
      expect((error as PackageError).reason).toBe('hash-mismatch')
    }
  })

  it('缺文件被拒', () => {
    const manifest = packBlueprint(dir, pkg)
    const missing = new AdmZip()
    missing.addFile(BLUEPRINT_MANIFEST_FILE, Buffer.from(JSON.stringify(manifest)))
    missing.addFile(
      'config/thresholds.json',
      readFileSync(join(dir, 'config', 'thresholds.json')),
    )
    const path = join(dir, 'missing.erpkg')
    missing.writeZip(path)

    try {
      unpackBlueprint(path)
      throw new Error('本应被拒')
    } catch (error) {
      expect((error as PackageError).reason).toBe('hash-mismatch')
    }
  })

  it('多出未声明的文件被拒', () => {
    const manifest = packBlueprint(dir, pkg)
    const extra = new AdmZip()
    extra.addFile(BLUEPRINT_MANIFEST_FILE, Buffer.from(JSON.stringify(manifest)))
    for (const [rel] of Object.entries(manifest.files)) {
      extra.addFile(rel, readFileSync(join(dir, rel)))
    }
    extra.addFile('sneaky.json', Buffer.from('{"x":1}'))
    const path = join(dir, 'extra.erpkg')
    extra.writeZip(path)

    try {
      unpackBlueprint(path)
      throw new Error('本应被拒')
    } catch (error) {
      expect((error as PackageError).reason).toBe('unexpected-file')
    }
  })

  it('readManifestFromPackage 只读清单', () => {
    const manifest = packBlueprint(dir, pkg)
    expect(readManifestFromPackage(pkg)).toEqual(manifest)
  })
})
