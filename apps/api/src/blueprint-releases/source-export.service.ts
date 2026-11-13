import {
  ForbiddenException,
  Injectable,
  Optional,
} from '@nestjs/common'
import { AuditLogsService } from '@sap/platform-core/audit-logs/audit-logs.service'
import type { BlueprintRelease } from './blueprint-release.entity'

export interface SourceExportPlan {
  status: 'license-verified' | 'blocked'
  release: {
    id: string
    blueprintId: string
    version: string
    releaseDigest: string
    packageId: string
  }
  license: {
    id: string | null
    expiresAt: string | null
  }
  generator: {
    configured: boolean
    /** 真实生成器由独立 change 授权；这里不伪装已可交付源码。 */
    deliverable: boolean
    message: string
  }
  reasons: string[]
}

/**
 * 6.3：全系统源码导出是**可选、受许可约束**的路径。
 *
 * 默认交付永远是签名 Blueprint Release + Runtime；本服务只校验
 * source-export license 并返回导出计划，不生成源码、不绕过发布/激活语义。
 * 未配置许可时 fail-closed；配置许可但生成器未安装时明确返回不可交付。
 */
@Injectable()
export class SourceExportService {
  constructor(@Optional() private readonly auditLogs?: AuditLogsService) {}

  async plan(
    release: BlueprintRelease,
    options: {
      organizationId: string
      actor: string
      requestedBy?: string
    },
  ): Promise<SourceExportPlan> {
    const licenseId = process.env.SOURCE_EXPORT_LICENSE_ID?.trim() || null
    const expiresRaw = process.env.SOURCE_EXPORT_LICENSE_EXPIRES_AT?.trim() || null
    const reasons: string[] = []
    if (!licenseId) reasons.push('未配置 source-export license')
    if (expiresRaw) {
      const expires = new Date(expiresRaw)
      if (Number.isNaN(expires.getTime())) {
        reasons.push('SOURCE_EXPORT_LICENSE_EXPIRES_AT 不是合法时间')
      } else if (expires.getTime() <= Date.now()) {
        reasons.push('source-export license 已过期')
      }
    }
    if (reasons.length > 0) {
      await this.audit(options, release, 'source_export.denied', {
        reasons,
        licenseId,
      })
      throw new ForbiddenException(
        `源码导出未获许可：${reasons.join('；')}（默认交付为签名 Release + Runtime）`,
      )
    }

    const generatorConfigured = Boolean(
      process.env.SOURCE_EXPORT_GENERATOR_URL?.trim(),
    )
    await this.audit(options, release, 'source_export.planned', {
      licenseId,
      generatorConfigured,
    })
    return {
      status: 'license-verified',
      release: {
        id: release.id,
        blueprintId: release.blueprintId,
        version: release.version,
        releaseDigest: release.releaseDigest,
        packageId: release.packageId,
      },
      license: { id: licenseId, expiresAt: expiresRaw },
      generator: {
        configured: generatorConfigured,
        deliverable: generatorConfigured,
        message: generatorConfigured
          ? '生成器已配置；导出仍由独立授权流水线执行'
          : '许可已校验，但源码生成器未配置；不会产出源码',
      },
      reasons: [],
    }
  }

  private async audit(
    options: {
      organizationId: string
      actor: string
      requestedBy?: string
    },
    release: BlueprintRelease,
    action: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditLogs?.create({
      organizationId: options.organizationId,
      action,
      resource: 'blueprint_release',
      resourceId: release.id,
      actor: options.actor,
      status: action.endsWith('denied') ? 'failure' : 'success',
      metadata: {
        blueprintId: release.blueprintId,
        version: release.version,
        releaseDigest: release.releaseDigest,
        requestedBy: options.requestedBy ?? null,
        ...metadata,
      },
      source: 'source-export',
    })
  }
}
