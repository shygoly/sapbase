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
} from '@sap/ui-kit/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@sap/ui-kit/collapsible'
import {
  BarChart3,
  Bot,
  BookOpen,
  Building2,
  ChevronRight,
  Circle,
  ClipboardList,
  Code2,
  DollarSign,
  Eye,
  GitPullRequest,
  History,
  Home,
  LayoutDashboard,
  LineChart,
  ListTree,
  Lock,
  LogOut,
  Package,
  Palette,
  Puzzle,
  Rocket,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  TestTube2,
  Upload,
  User,
  UserRound,
  Users,
  Workflow,
  Zap,
} from 'lucide-react'
import { UnifiedMenuItem } from '../types/navigation'
import { useUnifiedMenu } from '../hooks/use-unified-menu'
import { useAuth } from '../core/auth/auth-hooks'
import { useLogout } from '../core/auth/auth-hooks'
import { Button } from '@sap/ui-kit/button'

interface UnifiedSidebarProps {
  source: 'static' | 'api'
  staticItems?: UnifiedMenuItem[]
  onLogout?: () => void
}

function MenuItemIcon({ icon }: { icon?: string }) {
  if (!icon) return null

  const iconMap: Record<string, React.ReactNode> = {
    dashboard: <LayoutDashboard className='h-4 w-4' />,
    'layout-dashboard': <LayoutDashboard className='h-4 w-4' />,
    home: <Home className='h-4 w-4' />,
    users: <Users className='h-4 w-4' />,
    user: <UserRound className='h-4 w-4' />,
    menu: <ClipboardList className='h-4 w-4' />,
    building: <Building2 className='h-4 w-4' />,
    'building-2': <Building2 className='h-4 w-4' />,
    shield: <ShieldCheck className='h-4 w-4' />,
    history: <History className='h-4 w-4' />,
    settings: <Settings className='h-4 w-4' />,
    cog: <Settings className='h-4 w-4' />,
    sliders: <SlidersHorizontal className='h-4 w-4' />,
    chart: <BarChart3 className='h-4 w-4' />,
    analytics: <LineChart className='h-4 w-4' />,
    lock: <Lock className='h-4 w-4' />,
    shopping: <ShoppingCart className='h-4 w-4' />,
    dollar: <DollarSign className='h-4 w-4' />,
    workflow: <Workflow className='h-4 w-4' />,
    brain: <Bot className='h-4 w-4' />,
    bot: <Bot className='h-4 w-4' />,
    code: <Code2 className='h-4 w-4' />,
    eye: <Eye className='h-4 w-4' />,
    package: <Package className='h-4 w-4' />,
    'test-tube': <TestTube2 className='h-4 w-4' />,
    upload: <Upload className='h-4 w-4' />,
    book: <BookOpen className='h-4 w-4' />,
    'git-pull-request': <GitPullRequest className='h-4 w-4' />,
    rocket: <Rocket className='h-4 w-4' />,
    zap: <Zap className='h-4 w-4' />,
    'list-tree': <ListTree className='h-4 w-4' />,
    'scroll-text': <ScrollText className='h-4 w-4' />,
    palette: <Palette className='h-4 w-4' />,
    puzzle: <Puzzle className='h-4 w-4' />,
  }

  return (
    <span className='mr-2 flex h-4 w-4 shrink-0 items-center justify-center'>
      {iconMap[icon] || <Circle className='h-3 w-3' />}
    </span>
  )
}

function MenuItemComponent({
  item,
  pathname,
  level = 0,
}: {
  item: UnifiedMenuItem
  pathname: string
  level?: number
}) {
  const [isOpen, setIsOpen] = useState(false)
  const hasChildren = item.children && item.children.length > 0
  const href = item.path ?? ''
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
    } catch {
      // Logout error surfaced via UI
    }
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        <div className="flex items-center justify-between px-2 py-3">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-4 w-4 rounded-[2px] bg-[var(--seal)]" />
            <span className="font-serif text-[17px] leading-none tracking-[-0.02em]">sapbase</span>
          </div>
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
              <Link href={'/profile'}>
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
