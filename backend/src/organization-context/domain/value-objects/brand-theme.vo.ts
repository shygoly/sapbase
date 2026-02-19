import { BusinessRuleViolation } from '../errors'

/**
 * Value Object: Brand Theme Colors
 */
export class BrandTheme {
  private constructor(
    public readonly primary: string,
    public readonly secondary: string,
    public readonly accent: string,
    public readonly background: string,
    public readonly foreground: string,
  ) {}

  static create(
    primary: string,
    secondary: string,
    accent: string,
    background: string,
    foreground: string,
  ): BrandTheme {
    // Validate hex colors
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    const colors = [primary, secondary, accent, background, foreground]

    for (const color of colors) {
      if (!hexColorRegex.test(color)) {
        throw new BusinessRuleViolation(`Invalid color format: ${color}. Must be a valid hex color.`)
      }
    }

    return new BrandTheme(primary, secondary, accent, background, foreground)
  }

  static default(): BrandTheme {
    return new BrandTheme(
      '#000000', // primary
      '#666666', // secondary
      '#0066CC', // accent
      '#FFFFFF', // background
      '#000000', // foreground
    )
  }

  toJSON(): Record<string, string> {
    return {
      primary: this.primary,
      secondary: this.secondary,
      accent: this.accent,
      background: this.background,
      foreground: this.foreground,
    }
  }

  equals(other: BrandTheme): boolean {
    return (
      this.primary === other.primary &&
      this.secondary === other.secondary &&
      this.accent === other.accent &&
      this.background === other.background &&
      this.foreground === other.foreground
    )
  }
}
