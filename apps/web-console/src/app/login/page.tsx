/**
 * Console Login Page
 *
 * 只负责：Suspense 边界 + 台面参数。布局与逻辑在共享 `LoginSurface`。
 */

'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'
import { LoginSurface } from '@sap/app-shared/features/auth/components/login-surface'

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className='flex min-h-svh items-center justify-center bg-background'>
          <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
        </div>
      }
    >
      <LoginSurface surface='console' defaultRedirect='/admin/users' />
    </React.Suspense>
  )
}
