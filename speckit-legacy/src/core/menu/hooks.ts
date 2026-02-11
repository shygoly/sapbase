'use client'

import { useContext } from 'react'
import { MenuContext } from './context'

export function useMenu() {
  const context = useContext(MenuContext)
  if (!context) {
    throw new Error('useMenu must be used within MenuProvider')
  }
  return context
}
