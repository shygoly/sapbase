import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import { BRAND_CONFIG_REPOSITORY, EVENT_PUBLISHER } from '../../domain/repositories'
import type { IBrandConfigRepository } from '../../domain/repositories'
import type { IEventPublisher } from '../../domain/events'
import { BrandConfig } from '../../domain/entities/brand-config.entity'
import { BrandTheme } from '../../domain/value-objects/brand-theme.vo'
import { BrandConfigUpdatedEvent } from '../../domain/events/brand-config-updated.event'

export interface UpdateBrandConfigCommand {
  organizationId: string
  logoUrl?: string | null
  faviconUrl?: string | null
  theme?: {
    primary?: string
    secondary?: string
    accent?: string
    background?: string
    foreground?: string
  }
  customCss?: string | null
  appName?: string | null
  supportEmail?: string | null
  supportUrl?: string | null
}

@Injectable()
export class UpdateBrandConfigService {
  constructor(
    @Inject(BRAND_CONFIG_REPOSITORY)
    private readonly brandConfigRepository: IBrandConfigRepository,
    @Inject(EVENT_PUBLISHER)
    private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(command: UpdateBrandConfigCommand) {
    let config = await this.brandConfigRepository.findByOrganizationId(
      command.organizationId,
    )

    if (!config) {
      // Create new config if it doesn't exist
      config = BrandConfig.create(
        `brand-${Date.now()}`,
        command.organizationId,
      )
    }

    const updatedFields: string[] = []

    // Update logo
    if (command.logoUrl !== undefined) {
      config.updateLogo(command.logoUrl)
      updatedFields.push('logoUrl')
    }

    // Update favicon
    if (command.faviconUrl !== undefined) {
      config.updateFavicon(command.faviconUrl)
      updatedFields.push('faviconUrl')
    }

    // Update theme
    if (command.theme) {
      const currentTheme = config.theme
      const newTheme = BrandTheme.create(
        command.theme.primary ?? currentTheme.primary,
        command.theme.secondary ?? currentTheme.secondary,
        command.theme.accent ?? currentTheme.accent,
        command.theme.background ?? currentTheme.background,
        command.theme.foreground ?? currentTheme.foreground,
      )
      config.updateTheme(newTheme)
      updatedFields.push('theme')
    }

    // Update custom CSS
    if (command.customCss !== undefined) {
      config.updateCustomCss(command.customCss)
      updatedFields.push('customCss')
    }

    // Update app name
    if (command.appName !== undefined) {
      config.updateAppName(command.appName)
      updatedFields.push('appName')
    }

    // Update support email
    if (command.supportEmail !== undefined) {
      config.updateSupportEmail(command.supportEmail)
      updatedFields.push('supportEmail')
    }

    // Update support URL
    if (command.supportUrl !== undefined) {
      config.updateSupportUrl(command.supportUrl)
      updatedFields.push('supportUrl')
    }

    await this.brandConfigRepository.save(config)

    // Publish event
    await this.eventPublisher.publish(
      new BrandConfigUpdatedEvent(
        config.organizationId,
        config.id,
        updatedFields,
      ),
    )

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
