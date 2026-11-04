import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { BrandConfig as BrandConfigOrm } from '../../../organizations/brand-config.entity'
import { BrandConfig } from '../../domain/entities/brand-config.entity'
import { BrandTheme } from '../../domain/value-objects/brand-theme.vo'
import type { IBrandConfigRepository } from '../../domain/repositories'

@Injectable()
export class BrandConfigRepository implements IBrandConfigRepository {
  constructor(
    @InjectRepository(BrandConfigOrm)
    private readonly repo: Repository<BrandConfigOrm>,
  ) {}

  async findById(id: string): Promise<BrandConfig | null> {
    const row = await this.repo.findOne({ where: { id } })
    if (!row) return null
    return this.toDomain(row)
  }

  async findByOrganizationId(organizationId: string): Promise<BrandConfig | null> {
    const row = await this.repo.findOne({
      where: { organizationId },
    })
    if (!row) return null
    return this.toDomain(row)
  }

  async save(config: BrandConfig): Promise<void> {
    const existing = await this.repo.findOne({
      where: { organizationId: config.organizationId },
    })

    const ormEntity = this.toOrm(config, existing)

    await this.repo.save(ormEntity)
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id)
  }

  private toDomain(row: BrandConfigOrm): BrandConfig {
    const theme = row.theme
      ? BrandTheme.create(
          row.theme.primary,
          row.theme.secondary,
          row.theme.accent,
          row.theme.background,
          row.theme.foreground,
        )
      : BrandTheme.default()

    return BrandConfig.fromPersistence(
      row.id,
      row.organizationId,
      row.logoUrl,
      row.faviconUrl,
      theme,
      row.customCss,
      row.appName,
      row.supportEmail,
      row.supportUrl,
      row.createdAt,
      row.updatedAt,
    )
  }

  private toOrm(
    config: BrandConfig,
    existing: BrandConfigOrm | null,
  ): BrandConfigOrm {
    const orm = existing || new BrandConfigOrm()
    orm.id = config.id
    orm.organizationId = config.organizationId
    orm.logoUrl = config.logoUrl
    orm.faviconUrl = config.faviconUrl
    orm.theme = config.theme.toJSON() as {
      primary: string
      secondary: string
      accent: string
      background: string
      foreground: string
    }
    orm.customCss = config.customCss
    orm.appName = config.appName
    orm.supportEmail = config.supportEmail
    orm.supportUrl = config.supportUrl
    orm.updatedAt = config.updatedAt
    return orm
  }
}
