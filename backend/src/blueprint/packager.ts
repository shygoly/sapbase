import AdmZip from 'adm-zip'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, posix, sep } from 'node:path'
import type { BlueprintDependency, BlueprintLayerName, BlueprintManifest } from '@speckit/shared-schemas'
import { validateBlueprintPackage } from './blueprint-validator'

/** 作者提供的元数据文件名（**不打包进 .erpkg**：它是输入，不是产物）。 */
export const BLUEPRINT_META_FILE = 'blueprint.json'

/** 打包时生成的清单文件名（**打包进去**：它是包内唯一权威）。 */
export const BLUEPRINT_MANIFEST_FILE = 'manifest.json'

export interface BlueprintMeta {
  blueprint: string
  version: string
  runtime: string
  dependencies?: BlueprintDependency[]
  license?: { required: boolean; server?: string | null }
}

export class PackageError extends Error {
  constructor(
    message: string,
    readonly reason:
      | 'io'
      | 'malformed-zip'
      | 'path-traversal'
      | 'missing-manifest'
      | 'hash-mismatch'
      | 'unexpected-file'
      | 'invalid-manifest',
  ) {
    super(message)
    this.name = 'PackageError'
  }
}

function sha256(bytes: Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`
}

/**
 * 分层**按路径约定推导**（可预测、无歧义）：
 *   `config/**`    → configurable
 *   `protected/**` → protected
 *   其余           → public
 *
 * 为什么按约定而不是让作者手写：层是"这批文件谁能看"的声明，推导规则固定后
 * 就不会出现"同一个文件被声明成两层"这类人为错误（校验器仍会兜住）。
 */
export function layerOf(relPath: string): BlueprintLayerName {
  if (relPath.startsWith('config/')) return 'configurable'
  if (relPath.startsWith('protected/')) return 'protected'
  return 'public'
}

/** 递归列出目录下的文件（POSIX 相对路径，已排序，保证确定性）。 */
function walkFiles(dir: string, prefix = ''): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkFiles(abs, rel))
      continue
    }
    if (!entry.isFile()) continue
    // 作者元数据与旧清单不进包
    if (rel === BLUEPRINT_META_FILE || rel === BLUEPRINT_MANIFEST_FILE) continue
    out.push(rel)
  }
  return out
}

/** 从目录读取作者元数据（`blueprint.json`）。 */
export function readBlueprintMeta(dir: string): BlueprintMeta {
  const path = join(dir, BLUEPRINT_META_FILE)
  if (!existsSync(path)) {
    throw new PackageError(`缺少作者元数据：${path}`, 'io')
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as BlueprintMeta
  } catch (error) {
    throw new PackageError(`作者元数据解析失败：${(error as Error).message}`, 'io')
  }
}

/**
 * 打包：目录 → `.erpkg`。
 *
 * 清单由打包器**生成**（不是作者手写）：它记录每个文件的校验和与所属层，
 * 生成后立即用协议校验器自检 —— 打出一个连自己都通不过的包是没有意义的。
 */
export function packBlueprint(dir: string, outPath: string): BlueprintManifest {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new PackageError(`蓝图目录不存在：${dir}`, 'io')
  }
  const meta = readBlueprintMeta(dir)
  const relPaths = walkFiles(dir)
  if (relPaths.length === 0) {
    throw new PackageError('蓝图目录为空（除元数据外没有可打包的文件）', 'io')
  }

  const files: Record<string, string> = {}
  const layers: Record<string, string[]> = { public: [], configurable: [], protected: [] }
  const zip = new AdmZip()

  for (const rel of relPaths) {
    const bytes = readFileSync(join(dir, rel))
    files[rel] = sha256(bytes)
    layers[layerOf(rel)].push(rel)
    zip.addFile(rel, bytes)
  }

  const manifest: BlueprintManifest = {
    blueprint: meta.blueprint,
    version: meta.version,
    runtime: meta.runtime,
    ...(meta.dependencies ? { dependencies: meta.dependencies } : {}),
    layers: {
      public: layers.public,
      ...(layers.configurable.length ? { configurable: layers.configurable } : {}),
      ...(layers.protected.length ? { protected: layers.protected } : {}),
    },
    files,
    ...(meta.license ? { license: meta.license } : {}),
  }

  const check = validateBlueprintPackage(manifest)
  if (!check.valid) {
    throw new PackageError(
      `生成的清单未通过协议校验（打包器 bug 或目录内容异常）：${check.errors.join('; ')}`,
      'invalid-manifest',
    )
  }

  zip.addFile(BLUEPRINT_MANIFEST_FILE, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`))
  zip.writeZip(outPath)
  return manifest
}

export interface UnpackedBlueprint {
  manifest: BlueprintManifest
  /** 包内文件内容（**键是相对路径，值在内存里** —— 解包绝不落盘）。 */
  files: Map<string, Buffer>
}

/**
 * 拒绝可疑的 zip 条目名（路径穿越 / 绝对路径 / Windows 盘符）。
 *
 * 抽成纯函数是为了能直接对恶意样本做表驱动测试 —— 用 `adm-zip` 的 `addFile`
 * **造不出**穿越样本：它在写入时会自行清理 `../`（所以下面那个"用 zip 造样本"的
 * 测试实际走到的是清单校验）。但来自外部的恶意包不受这番清理保护，检查必须存在。
 */
export function assertSafeEntryName(raw: string): string {
  const normalized = posix.normalize(raw.split(sep).join('/'))
  if (
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.startsWith('/') ||
    normalized.includes('/../') ||
    /^[A-Za-z]:/.test(normalized)
  ) {
    throw new PackageError(`包内条目路径非法（疑似路径穿越）：${raw}`, 'path-traversal')
  }
  return normalized
}

/**
 * 解包：`.erpkg` → 内存结构（**不写磁盘**）。
 *
 * 不落盘是 zip slip 最强的防线：攻击者控制的路径根本没有被写入的机会。
 * 尽管如此，仍然显式拒绝可疑条目名（纵深防御 + 可测）。
 */
export function unpackBlueprint(packagePath: string): UnpackedBlueprint {
  let zip: AdmZip
  try {
    zip = new AdmZip(packagePath)
  } catch (error) {
    throw new PackageError(`不是合法 zip：${(error as Error).message}`, 'malformed-zip')
  }

  const files = new Map<string, Buffer>()
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue
    const normalized = assertSafeEntryName(entry.entryName)
    files.set(normalized, entry.getData())
  }

  const manifestBytes = files.get(BLUEPRINT_MANIFEST_FILE)
  if (!manifestBytes) {
    throw new PackageError(`包内缺少 ${BLUEPRINT_MANIFEST_FILE}`, 'missing-manifest')
  }

  let manifest: BlueprintManifest
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8')) as BlueprintManifest
  } catch (error) {
    throw new PackageError(`清单解析失败：${(error as Error).message}`, 'missing-manifest')
  }

  const check = validateBlueprintPackage(manifest)
  if (!check.valid) {
    throw new PackageError(`清单未通过协议校验：${check.errors.join('; ')}`, 'invalid-manifest')
  }

  // 逐文件核对校验和；多出的文件与缺失的文件都拒（manifest 是唯一权威）
  const declared = new Set(Object.keys(manifest.files))
  for (const [rel, expected] of Object.entries(manifest.files)) {
    const bytes = files.get(rel)
    if (!bytes) {
      throw new PackageError(`清单声明了 ${rel}，但包内没有该文件`, 'hash-mismatch')
    }
    const actual = sha256(bytes)
    if (actual !== expected) {
      throw new PackageError(
        `文件校验和不符：${rel}（期望 ${expected}，实际 ${actual}）`,
        'hash-mismatch',
      )
    }
  }
  for (const rel of files.keys()) {
    if (rel === BLUEPRINT_MANIFEST_FILE) continue
    if (!declared.has(rel)) {
      throw new PackageError(`包内存在清单未声明的文件：${rel}`, 'unexpected-file')
    }
  }

  return { manifest, files }
}

/** 便捷：只读清单（`GET /api/blueprints/:id/manifest` 用）。 */
export function readManifestFromPackage(packagePath: string): BlueprintManifest {
  return unpackBlueprint(packagePath).manifest
}

export interface CompiledRecord {
  /** 编译得到的 IR 摘要（`sha256:<64 hex>`）。 */
  irDigest: string
  compiledAt: string
}

/**
 * 把编译记录写回包内清单（**就地重写** `.erpkg`）。
 *
 * 为什么值得写回去：`compiled.irDigest` 是"这个包被编译成了什么"的**可核对声明**。
 * 有了它，加载时就能发现"包内容与编译产物已经漂移"（换过编译器版本、改过包又没重编、
 * 拿到的是别人编到一半的包）。没有它，加载方只能无条件相信"我这次编出来的就是对的"。
 *
 * 注意两点：
 *   1. `compiled` 只改清单，**不改任何被哈希覆盖的文件**，逐文件校验和因此仍然成立
 *      （`manifest.json` 自身不在 `files` 里）。
 *   2. 记录的是**摘要**而不是 IR 正文：把编译产物存进包内需要打包器支持附带产物，
 *      属后续范围；摘要在 v1 已足够做防漂移。
 */
export function stampCompiled(
  packagePath: string,
  record: CompiledRecord,
): BlueprintManifest {
  let zip: AdmZip
  try {
    zip = new AdmZip(packagePath)
  } catch (error) {
    throw new PackageError(`不是合法 zip：${(error as Error).message}`, 'malformed-zip')
  }
  const entry = zip.getEntry(BLUEPRINT_MANIFEST_FILE)
  if (!entry) {
    throw new PackageError(`包内缺少 ${BLUEPRINT_MANIFEST_FILE}`, 'missing-manifest')
  }

  let manifest: BlueprintManifest
  try {
    manifest = JSON.parse(entry.getData().toString('utf8')) as BlueprintManifest
  } catch (error) {
    throw new PackageError(`清单解析失败：${(error as Error).message}`, 'missing-manifest')
  }

  const next: BlueprintManifest = {
    ...manifest,
    compiled: { irDigest: record.irDigest, compiledAt: record.compiledAt },
  }
  const check = validateBlueprintPackage(next)
  if (!check.valid) {
    throw new PackageError(`写入编译记录后清单不再合法：${check.errors.join('; ')}`, 'invalid-manifest')
  }

  zip.updateFile(BLUEPRINT_MANIFEST_FILE, Buffer.from(`${JSON.stringify(next, null, 2)}\n`))
  zip.writeZip(packagePath)
  return next
}
