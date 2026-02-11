'use client';

import { useAuth } from '@/core/auth/hooks';
import { UserAvatarProfile } from '@/components/user-avatar-profile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import Link from 'next/link';

export function UserNav() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <Link href="/login" className='flex items-center gap-2 px-2 py-2 text-sm'>
        <Icons.login className='h-4 w-4' />
        Sign In
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className='w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent'>
          <UserAvatarProfile user={user} className='h-8 w-8' />
          <div className='flex-1 text-left'>
            <p className='text-sm font-medium leading-none'>{user.name}</p>
            <p className='text-xs text-muted-foreground'>
              {user.email}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-56'>
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href='/profile'>
            <Icons.user className='mr-2 h-4 w-4' />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href='/settings'>
            <Icons.settings className='mr-2 h-4 w-4' />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <Icons.login className='mr-2 h-4 w-4' />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
