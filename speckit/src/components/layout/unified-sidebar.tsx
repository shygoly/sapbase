'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronRight, LogOut, User } from 'lucide-react'
import { UnifiedMenuItem } from '@/types/navigation'
import { useLocalePrefix } from '@/hooks/use-locale'
import { useUnifiedMenu } from '@/hooks/use-unified-menu'
import { useAuth } from '@/core/auth/auth-hooks'
import { useLogout } from '@/core/auth/auth-hooks'
import { Button } from '@/components/ui/button'

interface UnifiedSidebarProps {
  source: 'static' | 'api'
  staticItems?: UnifiedMenuItem[]
  onLogout?: () => void
}

function MenuItemIcon({ icon }: { icon?: string }) {
  if (!icon) return null

  const iconMap: Record<string, React.ReactNode> = {
    dashboard: '📊',
    users: '👥',
    menu: '📋',
    building: '🏢',
    shield: '🛡️',
    history: '📜',
    settings: '⚙️',
    chart: '📈',
    analytics: '📉',
    user: '👤',
    lock: '🔒',
    shopping: '🛒',
    dollar: '💰',
    workflow: '🔄',
  }

  return <span className="mr-2">{iconMap[icon] || '•'}</span>
}

function MenuItemComponent({
  item,
  pathname,
  prefix,
  level = 0,
}: {
  item: UnifiedMenuItem
  pathname: string
  prefix: (path: string) => string
  level?: number
}) {
  const [isOpen, setIsOpen] = useState(false)
  const hasChildren = item.children && item.children.length > 0
  const href = item.path ? prefix(item.path) : ''
  const isActive = !!href && pathname === href

  // For nested items (level > 0), use SidebarMenuSubItem instead of SidebarMenuItem
  const MenuItemWrapper = level > 0 ? SidebarMenuSubItem : SidebarMenuItem
  const MenuButton = level > 0 ? SidebarMenuSubButton : SidebarMenuButton

  if (hasChildren) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} key={item.id}>
        <MenuItemWrapper>
          <CollapsibleTrigger asChild>
            <MenuButton
              className={`${isActive ? 'bg-accent text-accent-foreground' : ''}`}
              isActive={isActive}
            >
              <MenuItemIcon icon={item.icon} />
              <span>{item.label}</span>
              <ChevronRight className="ml-auto h-4 w-4 transition-transform" />
            </MenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.children?.map((child) => (
                <MenuItemComponent
                  key={child.id}
                  item={child}
                  pathname={pathname ?? ''}
                  prefix={prefix}
                  level={level + 1}
                />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </MenuItemWrapper>
      </Collapsible>
    )
  }

  if (item.path) {
    return (
      <MenuItemWrapper key={item.id}>
        <MenuButton
          asChild
          isActive={isActive}
          className={`${isActive ? 'bg-accent text-accent-foreground' : ''}`}
        >
          <Link href={href}>
            <MenuItemIcon icon={item.icon} />
            <span>{item.label}</span>
          </Link>
        </MenuButton>
      </MenuItemWrapper>
    )
  }

  return null
}

export function UnifiedSidebar({
  source,
  staticItems,
  onLogout,
}: UnifiedSidebarProps) {
  const pathname = usePathname()
  const prefix = useLocalePrefix()
  const state = useUnifiedMenu({ source, staticItems })
  const { user } = useAuth()
  const { logout } = useLogout()

  // Handle logout
  const handleLogout = async () => {
    try {
      if (onLogout) {
        onLogout()
      } else {
        await logout()
      }
    } catch (error) {
      // Logout error surfaced via UI
    }
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        <div className="flex items-center justify-between px-2 py-4">
          <h1 className="text-lg font-bold">Speckit</h1>
          <SidebarTrigger />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {state.loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Loading menu...</div>
          </div>
        ) : state.error ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-destructive">Error loading menu</div>
          </div>
        ) : (
          <SidebarMenu>
            {state.items.map((item) => (
              <MenuItemComponent
                key={item.id}
                item={item}
                pathname={pathname ?? ''}
                prefix={prefix}
              />
            ))}
          </SidebarMenu>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <div className="space-y-2">
          {user && (
            <div className="px-2 py-2 text-sm">
              <div className="font-medium truncate">{user.name}</div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              asChild
            >
              <Link href={prefix('/dashboard/profile')}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
