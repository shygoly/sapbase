'use client';

import {
  ThemeProvider as NextThemesProvider,
  ThemeProviderProps
} from 'next-themes';
import { ActiveThemeProvider } from './active-theme';

export default function ThemeProvider({
  children,
  ...props
}: ThemeProviderProps) {
  return (
    <ActiveThemeProvider initialTheme={props.defaultTheme}>
      <NextThemesProvider {...props}>{children}</NextThemesProvider>
    </ActiveThemeProvider>
  );
}
