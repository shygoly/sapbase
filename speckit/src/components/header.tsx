'use client'

import { Bell, User, LogOut } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'
import { LanguageSwitcher } from './language-switcher'
import { useAuth } from '@/core/auth/context'

export function Header() {
  const { logout } = useAuth()

  return (
    <header className="border-b bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
          <Bell className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        </button>
        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
          <User className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        </button>
        <ThemeToggle />
        <LanguageSwitcher />
        <button
          onClick={logout}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
        >
          <LogOut className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        </button>
      </div>
    </header>
  )
}
