import type { BrandConfig } from '../entities/brand-config.entity'

/**
 * Repository interface: Brand Configuration
 */
export interface IBrandConfigRepository {
  findById(id: string): Promise<BrandConfig | null>
  findByOrganizationId(organizationId: string): Promise<BrandConfig | null>
  save(config: BrandConfig): Promise<void>
  delete(id: string): Promise<void>
}

export const BRAND_CONFIG_REPOSITORY = Symbol('BRAND_CONFIG_REPOSITORY')
