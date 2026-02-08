'use client'

import React, { createContext, useState, useEffect, ReactNode } from 'react'
import type { Theme, ThemeContextType } from './types'
import { lightTheme } from './themes/light'
import { darkTheme } from './themes/dark'

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: Theme
}

export function ThemeProvider({ children, defaultTheme = 'light' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedTheme) {
      setThemeState(savedTheme)
      applyTheme(savedTheme)
    } else {
      applyTheme(defaultTheme)
    }
  }, [defaultTheme])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)
  }

  const applyTheme = (themeType: Theme) => {
    const themeConfig = themeType === 'dark' ? darkTheme : lightTheme
    const root = document.documentElement

    Object.entries(themeConfig.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value)
    })

    Object.entries(themeConfig.radius).forEach(([key, value]) => {
      root.style.setProperty(`--radius-${key}`, value)
    })

    root.classList.toggle('dark', themeType === 'dark')
  }

  const themeConfig = theme === 'dark' ? darkTheme : lightTheme

  return React.createElement(
    ThemeContext.Provider,
    { value: { theme, setTheme, colors: themeConfig.colors } },
    children
  )
}
