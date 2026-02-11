'use client'

import { Bell, User, LogOut, Settings, Users } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'
import { LanguageSwitcher } from './language-switcher'
import { useAuth } from '@/core/auth/context'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'
import Link from 'next/link'

export function Header() {
  const { logout } = useAuth()

  return (
    <header className="border-b bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger className="text-sm font-medium">Admin</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="w-48 p-4 space-y-2">
                  <NavigationMenuLink asChild>
                    <Link href="/admin/users" className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <div>
                          <div className="font-medium text-sm">Users</div>
                          <div className="text-xs text-gray-500">Manage system users</div>
                        </div>
                      </div>
                    </Link>
                  </NavigationMenuLink>
                  <NavigationMenuLink asChild>
                    <Link href="/admin/roles" className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                      <div className="font-medium text-sm">Roles</div>
                      <div className="text-xs text-gray-500">Configure user roles</div>
                    </Link>
                  </NavigationMenuLink>
                  <NavigationMenuLink asChild>
                    <Link href="/admin/departments" className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                      <div className="font-medium text-sm">Departments</div>
                      <div className="text-xs text-gray-500">Manage departments</div>
                    </Link>
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger className="text-sm font-medium">Settings</NavigationMenuTrigger>
              <NavigationMenuContent>
                <div className="w-48 p-4 space-y-2">
                  <NavigationMenuLink asChild>
                    <Link href="/settings" className="block px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        <div>
                          <div className="font-medium text-sm">System Settings</div>
                          <div className="text-xs text-gray-500">Configure system</div>
                        </div>
                      </div>
                    </Link>
                  </NavigationMenuLink>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>

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
