import { BadRequestException, Injectable } from '@nestjs/common'
import type { BlueprintRelease } from './blueprint-release.entity'

export type DeploymentProfileKey = 'shared-saas' | 'dedicated-saas' | 'standalone'

export interface DeploymentProfilePlan {
  profile: DeploymentProfileKey
  /** 所有剖面共用同一个 release digest；不复制版本。 */
  release: {
    id: string
    blueprintId: string
    version: string
    packageId: string
    releaseDigest: string
    runtimeRequirement: string
  }
  data: {
    database: 'shared-postgres-rls' | 'dedicated-postgres' | 'customer-postgres'
    schemaStrategy: 'shared-schema' | 'dedicated-schema' | 'customer-schema'
  }
  runtime: {
    container: 'platform-shared' | 'platform-dedicated' | 'customer-hosted'
    operations: 'platform' | 'customer'
  }
  license: {
    kind: 'organization-entitlement' | 'installation-entitlement' | 'offline-lease'
    requiresNetwork: boolean
  }
  bundle: {
    /** 同一 Runtime artifact；剖面只改变部署与授权参数。 */
    artifact: 'same-runtime-artifact'
    includesSource: false
    migrationMetadata: true
  }
}

/**
 * 6.2：三种交付剖面来自同一 Runtime artifact。
 *
 * 这里只生成部署/授权剖面，不重新打包业务定义；所有 profile 必须共享
 * 同一 releaseDigest、版本与 runtimeRequirement。源码不在任何默认剖面内。
 */
@Injectable()
export class DeploymentProfilesService {
  plan(release: BlueprintRelease): DeploymentProfilePlan[] {
    if (!release.releaseDigest || !release.version) {
      throw new BadRequestException('release 缺少 digest/version，不能生成交付剖面')
    }
    const common = {
      id: release.id,
      blueprintId: release.blueprintId,
      version: release.version,
      packageId: release.packageId,
      releaseDigest: release.releaseDigest,
      runtimeRequirement: release.runtimeRequirement,
    }
    return [
      {
        profile: 'shared-saas',
        release: common,
        data: { database: 'shared-postgres-rls', schemaStrategy: 'shared-schema' },
        runtime: { container: 'platform-shared', operations: 'platform' },
        license: { kind: 'organization-entitlement', requiresNetwork: true },
        bundle: {
          artifact: 'same-runtime-artifact',
          includesSource: false,
          migrationMetadata: true,
        },
      },
      {
        profile: 'dedicated-saas',
        release: common,
        data: { database: 'dedicated-postgres', schemaStrategy: 'dedicated-schema' },
        runtime: { container: 'platform-dedicated', operations: 'platform' },
        license: { kind: 'installation-entitlement', requiresNetwork: true },
        bundle: {
          artifact: 'same-runtime-artifact',
          includesSource: false,
          migrationMetadata: true,
        },
      },
      {
        profile: 'standalone',
        release: common,
        data: { database: 'customer-postgres', schemaStrategy: 'customer-schema' },
        runtime: { container: 'customer-hosted', operations: 'customer' },
        license: { kind: 'offline-lease', requiresNetwork: false },
        bundle: {
          artifact: 'same-runtime-artifact',
          includesSource: false,
          migrationMetadata: true,
        },
      },
    ]
  }

  /** 剖面不变量：三份计划共享同一 digest/version，且都不包含源码。 */
  assertSameArtifact(plans: DeploymentProfilePlan[]): void {
    const digests = new Set(plans.map((plan) => plan.release.releaseDigest))
    const versions = new Set(
      plans.map((plan) => `${plan.release.blueprintId}@${plan.release.version}`),
    )
    if (digests.size !== 1 || versions.size !== 1) {
      throw new BadRequestException('交付剖面必须共享同一 release digest/version')
    }
    if (plans.some((plan) => plan.bundle.includesSource)) {
      throw new BadRequestException('默认交付剖面不能包含源码；源码导出走 licensed export')
    }
  }
}
