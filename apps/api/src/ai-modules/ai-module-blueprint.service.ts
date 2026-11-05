import { Injectable } from '@nestjs/common'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BlueprintService,
  type DeliverLicenseInput,
} from '../blueprint/blueprint.service'
import type { LoadedBlueprint } from '../blueprint/loader'
import type { BlueprintManifest } from '@speckit/shared-schemas'
import {
  blueprintIdentity,
  PLATFORM_RUNTIME_RANGE,
} from '../module-registry/blueprint-export'
import { writeBlueprintDir, type BlueprintLayers } from './definition-to-blueprint'

export interface MaterializedAiBlueprint {
  packageId: string
  packagePath: string
  manifest: Record<string, unknown>
  irDigest: string
  compiledAt: string
}

/**
 * AI 定义 → 可编译 .erpkg。
 *
 * 这是“定义成功”与“能装载”之间缺失的一段：
 *   writeBlueprintDir → packageFrom → compile({ stamp: true })
 *
 * 失败时删除半成品包，避免留下“能列出但不能编译”的制品。
 */
@Injectable()
export class AIModuleBlueprintService {
  constructor(private readonly blueprints: BlueprintService) {}

  /** 对已有 AI 包补 license 并重签。 */
  async deliver(
    packageId: string,
    license: DeliverLicenseInput,
  ): Promise<{ id: string; packagePath: string; manifest: BlueprintManifest }> {
    return this.blueprints.deliverPackage(packageId, license)
  }

  /** 按租户装载验证（验签/授权/绑定都会跑）。 */
  async load(packageId: string, tenantId: string): Promise<LoadedBlueprint> {
    return this.blueprints.load(packageId, { tenantId })
  }

  async materialize(input: {
    name: string
    version: string
    layers: BlueprintLayers
  }): Promise<MaterializedAiBlueprint> {
    const { blueprint, version } = blueprintIdentity(input.name, input.version)
    const packageId = `${blueprint}-${version}`
    const staging = mkdtempSync(join(tmpdir(), 'ai-blueprint-'))

    try {
      writeBlueprintDir(staging, input.layers, {
        blueprint,
        version,
        runtime: PLATFORM_RUNTIME_RANGE,
      })
      mkdirSync(this.blueprints.packagesDirectory(), { recursive: true })
      const packaged = this.blueprints.packageFrom(staging)
      try {
        const compiled = await this.blueprints.compile(packageId, { stamp: true })
        return {
          packageId,
          packagePath: packaged.packagePath,
          manifest: packaged.manifest as unknown as Record<string, unknown>,
          irDigest: compiled.irDigest,
          compiledAt: new Date().toISOString(),
        }
      } catch (error) {
        rmSync(packaged.packagePath, { force: true })
        throw error
      }
    } finally {
      rmSync(staging, { recursive: true, force: true })
    }
  }
}
