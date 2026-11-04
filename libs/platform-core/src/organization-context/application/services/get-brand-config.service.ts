import { Injectable, Inject } from '@nestjs/common'
import { BrandTheme } from '../../domain/value-objects/brand-theme.vo'
import { BRAND_CONFIG_REPOSITORY } from '../../domain/repositories'
import type { IBrandConfigRepository } from '../../domain/repositories'

export interface GetBrandConfigCommand {
  organizationId: string
}

@Injectable()
export class GetBrandConfigService {
  constructor(
    @Inject(BRAND_CONFIG_REPOSITORY)
    private readonly brandConfigRepository: IBrandConfigRepository,
  ) {}

  async execute(command: GetBrandConfigCommand) {
    const config = await this.brandConfigRepository.findByOrganizationId(
      command.organizationId,
    )

    // 未配置过时返回默认值：前端每次加载都会请求本接口，
    // 404 会在控制台持续报错且需要客户端做兼容分支
    if (!config) {
      return {
        id: null,
        organizationId: command.organizationId,
        logoUrl: null,
        faviconUrl: null,
        theme: BrandTheme.default().toJSON(),
        customCss: null,
        appName: null,
        supportEmail: null,
        supportUrl: null,
        updatedAt: null,
      }
    }

    return {
      id: config.id,
      organizationId: config.organizationId,
      logoUrl: config.logoUrl,
      faviconUrl: config.faviconUrl,
      theme: config.theme.toJSON(),
      customCss: config.customCss,
      appName: config.appName,
      supportEmail: config.supportEmail,
      supportUrl: config.supportUrl,
      updatedAt: config.updatedAt,
    }
  }
}
