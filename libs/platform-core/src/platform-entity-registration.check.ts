import { Injectable, type OnApplicationBootstrap } from '@nestjs/common'
import { ModulesContainer } from '@nestjs/core'
import { getRepositoryToken } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { PLATFORM_CORE_ENTITIES } from './platform-core.entities'

/**
 * 启动自检：平台基座实体必须在 DataSource 里，且必须被某个 `forFeature` 覆盖。
 *
 * 只检查 `PLATFORM_CORE_ENTITIES`，不检查业务域实体——域实体由各自的
 * `*.entities.ts` 汇总点负责（见 docs/architecture/add-a-domain.md）。
 *
 * 失败策略是 fail-closed：在 `onApplicationBootstrap` 抛错，Nest 启动中断。
 * 这样漏注册会在部署时立刻暴露，而不是等到某条请求打到缺失的表。
 */
@Injectable()
export class PlatformEntityRegistrationCheck implements OnApplicationBootstrap {
  constructor(
    private readonly dataSource: DataSource,
    private readonly modules: ModulesContainer,
  ) {}

  onApplicationBootstrap(): void {
    const errors: string[] = []

    if ((PLATFORM_CORE_ENTITIES as readonly unknown[]).length === 0) {
      errors.push('PLATFORM_CORE_ENTITIES 为空——实体汇总点必须至少登记一个实体')
    }

    const featureTokens = new Set<unknown>()
    for (const moduleRef of this.modules.values()) {
      for (const wrapper of moduleRef.providers.values()) {
        featureTokens.add(wrapper.token)
      }
    }

    for (const entity of PLATFORM_CORE_ENTITIES) {
      if (!this.dataSource.hasMetadata(entity)) {
        errors.push(`${entity.name} 未注册到 TypeORM DataSource.entities`)
        continue
      }
      if (!featureTokens.has(getRepositoryToken(entity))) {
        errors.push(`${entity.name} 未被任何 TypeOrmModule.forFeature 覆盖（缺少可注入的 Repository）`)
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `[platform-core] 实体注册自检失败（${errors.length} 项）：\n- ${errors.join('\n- ')}`,
      )
    }
  }
}
