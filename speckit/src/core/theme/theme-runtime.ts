'use client';

import { useCallback, useMemo } from 'react';
import { useTheme } from 'next-themes';

import { useThemeConfig } from '@/components/themes/active-theme';

export type ThemeModeSetting = 'light' | 'dark' | 'auto';

export type ThemeRuntime = {
  themeMode: ThemeModeSetting;
  setThemeMode: (mode: ThemeModeSetting) => void;
  activeTheme: string;
  setActiveTheme: (theme: string) => void;
};

function normalizeThemeMode(theme: string | undefined): ThemeModeSetting {
  if (theme === 'light' || theme === 'dark') return theme;
  return 'auto';
}

export function useThemeRuntime(): ThemeRuntime {
  const { theme, setTheme } = useTheme();
  const { activeTheme, setActiveTheme } = useThemeConfig();

  const themeMode = useMemo(() => normalizeThemeMode(theme), [theme]);

  const setThemeMode = useCallback(
    (mode: ThemeModeSetting) => {
      setTheme(mode === 'auto' ? 'system' : mode);
    },
    [setTheme]
  );

  return {
    themeMode,
    setThemeMode,
    activeTheme,
    setActiveTheme
  };
}

