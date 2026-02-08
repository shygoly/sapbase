'use client'

import React, { createContext, useState, ReactNode } from 'react'
import type { MenuItem, MenuConfig } from './config'
import { defaultMenuConfig } from './config'

export interface MenuContextType {
  menu: MenuConfig
  setMenu: (menu: MenuConfig) => void
  expandedItems: Set<string>
  toggleExpanded: (id: string) => void
}

export const MenuContext = createContext<MenuContextType | undefined>(undefined)

interface MenuProviderProps {
  children: ReactNode
  initialMenu?: MenuConfig
}

export function MenuProvider({ children, initialMenu = defaultMenuConfig }: MenuProviderProps) {
  const [menu, setMenu] = useState<MenuConfig>(initialMenu)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  return React.createElement(
    MenuContext.Provider,
    { value: { menu, setMenu, expandedItems, toggleExpanded } },
    children
  )
}
