'use client';

import React from 'react';
import { SidebarTrigger } from '@sap/ui-kit/sidebar';
import { Separator } from '@sap/ui-kit/separator';
import { Breadcrumbs } from '../components/breadcrumbs';
import SearchInput from '../components/search-input';
import { UserNav } from './user-nav';
import { ThemeSelector } from '@sap/ui-theme/theme-selector';
import { ThemeModeToggle } from '@sap/ui-theme/theme-mode-toggle';
import CtaGithub from './cta-github';
import { NotificationBell } from '../components/notification-bell';

export default function Header({ assistant }: { assistant?: React.ReactNode }) {
  return (
    <header className='border-border/70 flex h-14 shrink-0 items-center justify-between gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12'>
      <div className='flex items-center gap-2 px-6'>
        <SidebarTrigger className='-ml-1' />
        <Separator orientation='vertical' className='mr-2 h-4' />
        <Breadcrumbs />
      </div>

      <div className='flex items-center gap-2 px-6'>
        <CtaGithub />
        {assistant}
        <div className='hidden md:flex'>
          <SearchInput />
        </div>
        <NotificationBell />
        <UserNav />
        <ThemeModeToggle />
        <ThemeSelector />
      </div>
    </header>
  );
}
