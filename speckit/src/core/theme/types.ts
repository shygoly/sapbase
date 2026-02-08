export type Theme = 'light' | 'dark'

export interface ThemeColors {
  background: string
  foreground: string
  card: string
  cardForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  destructive: string
  destructiveForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  border: string
  input: string
  ring: string
}

export interface ThemeConfig {
  colors: ThemeColors
  radius: {
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
  }
}

export interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  colors: ThemeColors
}
