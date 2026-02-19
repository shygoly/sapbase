import { Injectable, Inject, NotFoundException } from '@nestjs/common'
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

    if (!config) {
      throw new NotFoundException(
        `Brand config not found for organization ${command.organizationId}`,
      )
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
