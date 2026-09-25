import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { BlueprintManifest } from '@speckit/shared-schemas'
import { packBlueprint, readBlueprintMeta, unpackBlueprint } from './packager'

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
}
