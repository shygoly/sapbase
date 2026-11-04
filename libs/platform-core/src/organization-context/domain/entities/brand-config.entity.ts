import { DomainError, BusinessRuleViolation } from '../errors'
import { BrandTheme } from '../value-objects/brand-theme.vo'

/**
 * Domain entity: Brand Configuration (White-labeling)
 */
export class BrandConfig {
  private constructor(
    public readonly id: string,
    public readonly organizationId: string,
    private _logoUrl: string | null,
    private _faviconUrl: string | null,
    private _theme: BrandTheme,
    private _customCss: string | null,
    private _appName: string | null,
    private _supportEmail: string | null,
    private _supportUrl: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  get logoUrl(): string | null {
    return this._logoUrl
  }

  get faviconUrl(): string | null {
    return this._faviconUrl
  }

  get theme(): BrandTheme {
    return this._theme
  }

  get customCss(): string | null {
    return this._customCss
  }

  get appName(): string | null {
    return this._appName
  }

  get supportEmail(): string | null {
    return this._supportEmail
  }

  get supportUrl(): string | null {
    return this._supportUrl
  }

  static create(
    id: string,
    organizationId: string,
    logoUrl: string | null = null,
    faviconUrl: string | null = null,
    theme: BrandTheme = BrandTheme.default(),
    customCss: string | null = null,
    appName: string | null = null,
    supportEmail: string | null = null,
    supportUrl: string | null = null,
  ): BrandConfig {
    return new BrandConfig(
      id,
      organizationId,
      logoUrl,
      faviconUrl,
      theme,
      customCss,
      appName,
      supportEmail,
      supportUrl,
      new Date(),
      new Date(),
    )
  }

  static fromPersistence(
    id: string,
    organizationId: string,
    logoUrl: string | null,
    faviconUrl: string | null,
    theme: BrandTheme,
    customCss: string | null,
    appName: string | null,
    supportEmail: string | null,
    supportUrl: string | null,
    createdAt: Date,
    updatedAt: Date,
  ): BrandConfig {
    return new BrandConfig(
      id,
      organizationId,
      logoUrl,
      faviconUrl,
      theme,
      customCss,
      appName,
      supportEmail,
      supportUrl,
      createdAt,
      updatedAt,
    )
  }

  updateLogo(logoUrl: string | null): void {
    if (logoUrl !== null && !this.isValidUrl(logoUrl)) {
      throw new BusinessRuleViolation('Invalid logo URL format')
    }
    this._logoUrl = logoUrl
    this.updateTimestamp()
  }

  updateFavicon(faviconUrl: string | null): void {
    if (faviconUrl !== null && !this.isValidUrl(faviconUrl)) {
      throw new BusinessRuleViolation('Invalid favicon URL format')
    }
    this._faviconUrl = faviconUrl
    this.updateTimestamp()
  }

  updateTheme(theme: BrandTheme): void {
    this._theme = theme
    this.updateTimestamp()
  }

  updateCustomCss(customCss: string | null): void {
    if (customCss !== null && customCss.length > 10000) {
      throw new BusinessRuleViolation('Custom CSS cannot exceed 10000 characters')
    }
    this._customCss = customCss
    this.updateTimestamp()
  }

  updateAppName(appName: string | null): void {
    if (appName !== null && appName.trim().length === 0) {
      throw new DomainError('App name cannot be empty')
    }
    this._appName = appName
    this.updateTimestamp()
  }

  updateSupportEmail(supportEmail: string | null): void {
    if (supportEmail !== null && !this.isValidEmail(supportEmail)) {
      throw new BusinessRuleViolation('Invalid support email format')
    }
    this._supportEmail = supportEmail
    this.updateTimestamp()
  }

  updateSupportUrl(supportUrl: string | null): void {
    if (supportUrl !== null && !this.isValidUrl(supportUrl)) {
      throw new BusinessRuleViolation('Invalid support URL format')
    }
    this._supportUrl = supportUrl
    this.updateTimestamp()
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  private updateTimestamp(): void {
    ;(this as any).updatedAt = new Date()
  }
}
