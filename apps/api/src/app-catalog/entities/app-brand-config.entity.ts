import { Column, Entity, Index, Unique } from 'typeorm'
import { TenantAwareEntity } from '../../common/entities/tenant-aware.entity'

@Entity('app_brand_configs')
@Unique('uq_app_brand_configs_org_app', ['organizationId', 'appKey'])
@Index('idx_app_brand_configs_org_app', ['organizationId', 'appKey'])
export class AppBrandConfig extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 64 })
  appKey: string

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  faviconUrl: string | null

  @Column({ type: 'jsonb', nullable: true })
  theme: {
    primary: string
    secondary: string
    accent: string
    background: string
    foreground: string
  } | null

  @Column({ type: 'text', nullable: true })
  customCss: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  appName: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  supportEmail: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  supportUrl: string | null
}
