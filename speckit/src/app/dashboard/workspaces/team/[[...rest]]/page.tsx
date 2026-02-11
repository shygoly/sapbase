'use client';

import PageContainer from '@/components/layout/page-container';
import { useTheme } from 'next-themes';
import { teamInfoContent } from '@/config/infoconfig';

export default function TeamPage() {
  return (
    <div className='p-6'>
      <h1 className='text-2xl font-bold'>Team Management</h1>
      <p className='text-muted-foreground mt-2'>Team management feature has been removed</p>
    </div>
  );
}

