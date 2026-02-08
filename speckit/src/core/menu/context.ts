'use client'

import React, { createContext, useState, ReactNode, useEffect } from 'react'
import type { MenuItem, MenuConfig } from './config'
import { defaultMenuConfig } from './config'
import { useAuth } from '@/core/auth/context'

export interface MenuContextType {
  menu: MenuConfig
  setMenu: (menu: MenuConfig) => void
  expandedItems: Set<string>
  toggleExpanded: (id: string) => void
  isLoading: boolean
}

export const MenuContext = createContext<MenuContextType | undefined>(undefined)

interface MenuProviderProps {
  children: ReactNode
  initialMenu?: MenuConfig
}

export function MenuProvider({ children, initialMenu = defaultMenuConfig }: MenuProviderProps) {
  const [menu, setMenu] = useState<MenuConfig>(initialMenu)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    const loadMenu = async () => {
      if (!user) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        // Get user permissions from auth context
        const userPermissions = user.permissions || []

        // Fetch menu from backend
        const response = await fetch('/api/menu/filtered', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions: userPermissions }),
        })

        if (response.ok) {
          const menuItems = await response.json()
          setMenu({ items: menuItems })
        } else {
          // Fallback to default menu if backend fails
          setMenu(initialMenu)
        }
      } catch (error) {
        console.error('Failed to load menu:', error)
        // Fallback to default menu if fetch fails
        setMenu(initialMenu)
      } finally {
        setIsLoading(false)
      }
    }

    loadMenu()
  }, [user, initialMenu])

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
    { value: { menu, setMenu, expandedItems, toggleExpanded, isLoading } },
    children
  )
}
