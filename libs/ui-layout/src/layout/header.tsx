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

export default function Header() {
  return (
    <header className='flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12'>
      <div className='flex items-center gap-2 px-4'>
        <SidebarTrigger className='-ml-1' />
        <Separator orientation='vertical' className='mr-2 h-4' />
        <Breadcrumbs />
      </div>

      <div className='flex items-center gap-2 px-4'>
        <CtaGithub />
        <div className='hidden md:flex'>
          <SearchInput />
        </div>
        <UserNav />
        <ThemeModeToggle />
        <ThemeSelector />
      </div>
    </header>
  );
}
