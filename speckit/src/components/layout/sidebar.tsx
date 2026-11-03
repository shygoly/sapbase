/**
 * Sidebar Component - Updated with Menu Integration
 */

'use client'

import React, { Suspense } from 'react'
import Link from 'next/link'
import { useMenuItems } from '@/core/navigation/menu-hooks'
import { useAuth } from '@/core/auth/auth-hooks'
import { useSidebar } from '@/core/ui/ui-hooks'
import { MenuItem } from '@/lib/api/types'
import { Menu, X } from 'lucide-react'

function SidebarContent() {
  const { items: menuItems, isLoading } = useMenuItems()
  const { user } = useAuth()
  const { sidebarOpen, toggleSidebar } = useSidebar()

  const renderMenuItems = (items: MenuItem[], level = 0) => {
    return items.map((item) => (
      <div key={item.id}>
        {item.path ? (
          <Link
            href={item.path}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground"
          >
            {item.icon && <span className="text-lg">{item.icon}</span>}
            <span>{item.label}</span>
          </Link>
        ) : (
          <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground/80">
            {item.icon && <span className="text-lg">{item.icon}</span>}
            <span>{item.label}</span>
          </div>
        )}

        {item.children && item.children.length > 0 && (
          <div className="ml-4 space-y-1">
            {renderMenuItems(item.children, level + 1)}
          </div>
        )}
      </div>
    ))
  }

  return (
    <>
      <button
        onClick={toggleSidebar}
        className="fixed left-4 top-4 z-40 rounded-lg bg-card p-2 shadow-lg lg:hidden"
      >
        {sidebarOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </button>

      <aside
        className={`fixed left-0 top-0 z-30 h-screen w-64 bg-card shadow-lg transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-border px-6 py-4">
            <h1 className="text-xl font-bold text-foreground">ERP Runtime</h1>
            <p className="text-xs text-muted-foreground">v1.0</p>
          </div>

          {user && (
            <div className="border-b border-border px-6 py-4">
              <p className="text-sm font-medium text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <p className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                {user.role}
              </p>
            </div>
          )}

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-8 rounded-lg bg-border animate-pulse"
                  />
                ))}
              </div>
            ) : menuItems.length > 0 ? (
              <div className="space-y-1">{renderMenuItems(menuItems)}</div>
            ) : (
              <p className="text-sm text-muted-foreground">No menu items available</p>
            )}
          </nav>

          <div className="border-t border-border px-6 py-4">
            <Link
              href="/login"
              className="block rounded-lg bg-red-50 px-3 py-2 text-center text-sm font-medium text-red-600 hover:bg-red-100"
            >
              Logout
            </Link>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={toggleSidebar}
        />
      )}
    </>
  )
}

export function Sidebar() {
  return (
    <Suspense fallback={null}>
      <SidebarContent />
    </Suspense>
  )
}
