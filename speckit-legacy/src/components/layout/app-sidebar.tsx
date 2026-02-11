'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
} from '@/components/ui/sidebar';
import { Icons } from '@/components/icons';
import { useAuth } from '@/core/auth/hooks';
import { PermissionGuard } from '@/core/auth/permission-guard';
import { getAccessibleNav } from '@/core/navigation/nav-adapter';
import { NAV_CONFIG } from '@/config/nav-config';
import { NavItem } from '@/types/nav';

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Create permission guard instance
  const permissionGuard = useMemo(() => {
    return new PermissionGuard({ user });
  }, [user]);

  // Filter navigation items based on permissions
  const accessibleNav = useMemo(() => {
    return getAccessibleNav(NAV_CONFIG.items, { user });
  }, [user]);

  const isActive = (path?: string) => {
    if (!path) return false;
    return pathname === path || pathname.startsWith(path + '/');
  };

  const renderNavItem = (item: NavItem, depth = 0) => {
    const Icon = item.icon ? (Icons[item.icon as keyof typeof Icons] as any) : null;
    const hasChildren = item.children && item.children.length > 0;

    if (depth === 0) {
      return (
        <SidebarMenuItem key={item.id}>
          {hasChildren ? (
            <>
              <SidebarMenuButton asChild>
                <div className='flex items-center gap-2 cursor-pointer'>
                  {Icon && <Icon className='h-4 w-4' />}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className='ml-auto text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded'>
                      {item.badge}
                    </span>
                  )}
                </div>
              </SidebarMenuButton>
              <SidebarMenuSub>
                {item.children?.map((child) => renderNavItem(child, depth + 1))}
              </SidebarMenuSub>
            </>
          ) : (
            <SidebarMenuButton
              asChild
              isActive={isActive(item.path)}
            >
              <Link href={item.path || '#'} className={item.disabled ? 'pointer-events-none opacity-50' : ''}>
                {Icon && <Icon className='h-4 w-4' />}
                <span>{item.label}</span>
                {item.badge && (
                  <span className='ml-auto text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded'>
                    {item.badge}
                  </span>
                )}
              </Link>
            </SidebarMenuButton>
          )}
        </SidebarMenuItem>
      );
    }

    // Nested items
    return (
      <SidebarMenuSubItem key={item.id}>
        <SidebarMenuSubButton
          asChild
          isActive={isActive(item.path)}
        >
          <Link href={item.path || '#'} className={item.disabled ? 'pointer-events-none opacity-50' : ''}>
            {Icon && <Icon className='h-4 w-4' />}
            <span>{item.label}</span>
            {item.badge && (
              <span className='ml-auto text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded'>
                {item.badge}
              </span>
            )}
          </Link>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <div className='flex items-center gap-2 px-2 py-4'>
          <Icons.logo className='h-6 w-6' />
          <span className='font-semibold'>Speckit</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {accessibleNav.map((item) => renderNavItem(item))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        {/* Footer content will be added in user-nav component */}
      </SidebarFooter>
    </Sidebar>
  );
}
