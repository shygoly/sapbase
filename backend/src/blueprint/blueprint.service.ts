import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Validator } from 'jsonschema'
import type { BlueprintCompileResult, BlueprintManifest } from '@speckit/shared-schemas'
import { loadSchema } from '../common/protocol/schema-loader'
import { packBlueprint, readBlueprintMeta, stampCompiled, unpackBlueprint } from './packager'
import { compileBlueprint } from './compiler'
import { signPackage } from './license'
import { loadBlueprint, type BlueprintAuditRecord, type LoadedBlueprint } from './loader'
import { AtomicRegistryService } from '../atomic-registry/atomic-registry.service'
import { AuditLogsService } from '../audit-logs/audit-logs.service'

export type DeliverErrorReason = 'missing-template' | 'missing-private-key' | 'invalid-license'

export class DeliverError extends Error {
  constructor(
    message: string,
    readonly reason: DeliverErrorReason,
  ) {
    super(message)
    this.name = 'DeliverError'
  }
}

export interface DeliverLicenseInput {
  grantedTo: string[]
  resell?: boolean
  expiresAt?: string
  issuer?: string
}

/**
 * 蓝图包服务（v1 的"注册表"就是**一个目录**）。
 *
 * 为什么先用目录而不是数据库表：v1 只需要"包在哪、能不能读"，
 * 加表会把版本/租户/权限一整套模型提前引进来（那是市场与许可那条线的事）。
 * 等要做交易与授权时再升级成表，而接口形态不变。
 */
@Injectable()
export class BlueprintService {
  private readonly logger = new Logger(BlueprintService.name)
  private readonly packagesDir =
    process.env.BLUEPRINT_PACKAGES_DIR ??
    resolve(__dirname, '../../../blueprints')
  private readonly templatesDir =
    process.env.BLUEPRINT_TEMPLATES_DIR ??
    resolve(__dirname, '../../../templates')

  constructor(
    private readonly atomicRegistry: AtomicRegistryService,
    @Optional() private readonly auditLogs?: AuditLogsService,
  ) {}

  /** 打包目录为 `.erpkg`（不指定 out 时落到包目录，名字由 id + 版本决定）。 */
  packageFrom(
    dir: string,
    out?: string,
  ): { manifest: BlueprintManifest; packagePath: string } {
    // 先读作者元数据算出目标路径，再打一次包 —— 不重复打包
    const meta = readBlueprintMeta(dir)
    const packagePath =
      out ?? join(this.packagesDir, `${meta.blueprint}-${meta.version}.erpkg`)
    const manifest = packBlueprint(dir, packagePath)
    return { manifest, packagePath }
  }

  /** 列出包目录里的所有包（id = 文件名去掉 .erpkg）。 */
  list(): Array<{ id: string; file: string; manifest: BlueprintManifest }> {
    if (!existsSync(this.packagesDir)) return []
    return readdirSync(this.packagesDir)
      .filter((file) => file.endsWith('.erpkg'))
      .map((file) => {
        const id = file.replace(/\.erpkg$/, '')
        try {
          return { id, file, manifest: unpackBlueprint(join(this.packagesDir, file)).manifest }
        } catch (error) {
          // 坏包不阻断列表，但要留痕（否则"为什么这个包不见了"无从查起）
          this.logger.warn(`跳过无法读取的包 ${file}：${(error as Error).message}`)
          return null
        }
      })
      .filter((entry): entry is { id: string; file: string; manifest: BlueprintManifest } =>
        entry !== null,
      )
  }

  /** 读取某个包的清单（包不存在或不可读 → 404）。 */
  manifestOf(id: string): BlueprintManifest {
    const path = join(this.packagesDir, `${id}.erpkg`)
    if (!existsSync(path)) {
      throw new NotFoundException(`蓝图包不存在：${id}`)
    }
    try {
      return unpackBlueprint(path).manifest
    } catch (error) {
      // 包损坏属于"服务端数据问题"，返回 404 会误导调用方以为是路径错，故明确区分
      throw new NotFoundException(`蓝图包无法读取：${id}（${(error as Error).message}）`)
    }
  }

  packagesDirectory(): string {
    return this.packagesDir
  }

  private packagePathOf(id: string): string {
    const path = join(this.packagesDir, `${id}.erpkg`)
    if (!existsSync(path)) {
      throw new NotFoundException(`蓝图包不存在：${id}`)
    }
    return path
  }

  /**
   * 编译包内的蓝图：解包 → 编译（依赖闭包走原子注册表）。
   *
   * `stamp = true` 时把编译得到的 IR 摘要写回包内清单 —— 之后的加载会拿它比对，
   * 于是"包内容与编译结果不一致"就变成可检测的（见 `loader.loadBlueprint`）。
   */
  async compile(
    id: string,
    options: { stamp?: boolean } = {},
  ): Promise<BlueprintCompileResult> {
    const path = this.packagePathOf(id)
    const result = await compileBlueprint(unpackBlueprint(path), this.atomicRegistry)
    if (options.stamp) {
      stampCompiled(path, {
        irDigest: result.irDigest,
        compiledAt: new Date().toISOString(),
      })
    }
    return result
  }

  /** 加载蓝图包 → 可执行计划（fail-closed：任一校验不过即拒）。 */
  async load(id: string, options: { tenantId?: string } = {}): Promise<LoadedBlueprint> {
    const loaded = await loadBlueprint(this.packagePathOf(id), this.atomicRegistry, {
      tenantId: options.tenantId,
      env: process.env,
    })
    await this.persistAudit(loaded.audit, options.tenantId)
    return loaded
  }

  /**
   * 一条命令：模板目录 → 已授权、已签名的可交付包。
   *
   * 顺序写死在本方法里，调用方不各自拼装。
   * **先签后编会让签名失效**（compiled 在签名覆盖范围内），所以必须
   * 写 license → 打包 → 编译盖章 → 签名。
   */
  async deliver(
    templateId: string,
    licenseInput: DeliverLicenseInput,
  ): Promise<{ id: string; packagePath: string; manifest: BlueprintManifest }> {
    const privateKeyPem = process.env.BLUEPRINT_LICENSE_PRIVATE_KEY
    if (!privateKeyPem) {
      throw new DeliverError(
        '未配置 BLUEPRINT_LICENSE_PRIVATE_KEY，拒绝产出未签名制品',
        'missing-private-key',
      )
    }

    const templateDir = join(this.templatesDir, templateId)
    if (!existsSync(templateDir)) {
      throw new DeliverError(`模板不存在：${templateId}`, 'missing-template')
    }

    const license = {
      license: 'blueprint-license/v1',
      grantedTo: licenseInput.grantedTo,
      resell: licenseInput.resell ?? false,
      ...(licenseInput.expiresAt ? { expiresAt: licenseInput.expiresAt } : {}),
      issuer: licenseInput.issuer ?? 'sapbase-platform',
    }
    const check = new Validator().validate(license, loadSchema('blueprint-license.schema.json'))
    if (!check.valid) {
      throw new DeliverError(
        `license.json 未通过协议校验：${check.errors.map((error) => error.message).join('; ')}`,
        'invalid-license',
      )
    }

    mkdirSync(this.packagesDir, { recursive: true })
    const staging = mkdtempSync(join(tmpdir(), 'bp-deliver-'))
    try {
      // 复制到 staging，绝不改 templates/ 源码
      cpSync(templateDir, staging, { recursive: true })
      writeFileSync(join(staging, 'license.json'), `${JSON.stringify(license, null, 2)}\n`)

      const meta = readBlueprintMeta(staging)
      const packagePath = join(this.packagesDir, `${meta.blueprint}-${meta.version}.erpkg`)
      packBlueprint(staging, packagePath)

      const compiled = await compileBlueprint(unpackBlueprint(packagePath), this.atomicRegistry)
      stampCompiled(packagePath, {
        irDigest: compiled.irDigest,
        compiledAt: new Date().toISOString(),
      })
      const manifest = signPackage(packagePath, privateKeyPem)
      return { id: `${meta.blueprint}-${meta.version}`, packagePath, manifest }
    } finally {
      rmSync(staging, { recursive: true, force: true })
    }
  }

  /** 装载器是纯函数，审计记录由这里落库到既有 AuditLogsService。 */
  private async persistAudit(audit: BlueprintAuditRecord[], tenantId?: string): Promise<void> {
    if (!this.auditLogs || !tenantId) return
    for (const record of audit) {
      try {
        await this.auditLogs.create({
          action: record.action,
          resource: 'blueprint',
          actor: 'blueprint-loader',
          status: 'success',
          organizationId: tenantId,
          metadata: record.detail,
        })
      } catch (error) {
        this.logger.warn(`蓝图审计落库失败：${(error as Error).message}`)
      }
    }
  }
}
