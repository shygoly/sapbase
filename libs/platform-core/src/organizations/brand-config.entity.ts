import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm'
import { BaseEntity } from '../common/entities/base.entity'
import { Organization } from './organization.entity'

@Entity('brand_configs')
export class BrandConfig extends BaseEntity {
  @Column({ type: 'uuid' })
  organizationId: string

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

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization
}
