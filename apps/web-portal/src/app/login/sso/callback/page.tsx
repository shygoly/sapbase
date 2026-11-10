'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { authApi, type LoginResponseWithOrgs } from '@sap/app-shared/lib/api/auth.api'
import { useAuthStore } from '@sap/app-shared/core/store'
import { useOrganizationStore } from '@sap/app-shared/core/store/organization.store'
import { usePermissionStore } from '@sap/app-shared/core/store/permission.store'

const SSO_PENDING_KEY = 'sso:pending'

interface PendingSso {
  providerKey: string
  organizationId: string
  state?: string
  nonce?: string
  codeVerifier?: string
  returnUrl?: string
}

export default function SsoCallbackPage() {
  return (
    <React.Suspense
      fallback={
        <div className='flex min-h-screen items-center justify-center'>
          <Loader2 className='h-6 w-6 animate-spin' />
        </div>
      }
    >
      <SsoCallback />
    </React.Suspense>
  )
}

function SsoCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setUser } = useAuthStore()
  const setPermissions = usePermissionStore((state) => state.setPermissions)
  const { setCurrentOrganization, setOrganizations } = useOrganizationStore()
  const [message, setMessage] = useState('正在完成统一身份登录…')

  useEffect(() => {
    const run = async () => {
      const raw = sessionStorage.getItem(SSO_PENDING_KEY)
      if (!raw) {
        setMessage('登录会话已过期，请返回登录页重试。')
        return
      }
      const pending = JSON.parse(raw) as PendingSso
      sessionStorage.removeItem(SSO_PENDING_KEY)

      const state = searchParams?.get('state') || undefined
      if (pending.state && state && pending.state !== state) {
        setMessage('SSO state 校验失败，请返回登录页重试。')
        return
      }
      if (searchParams?.get('error')) {
        setMessage(searchParams.get('error_description') || searchParams.get('error') || 'SSO 登录失败')
        return
      }

      try {
        const response = await authApi.ssoCallback(pending.providerKey, {
          organizationId: pending.organizationId,
          code: searchParams?.get('code') || undefined,
          ticket: searchParams?.get('ticket') || undefined,
          samlResponse: searchParams?.get('SAMLResponse') || undefined,
          state,
          nonce: pending.nonce,
          codeVerifier: pending.codeVerifier,
        })
        applyLoginResponse(response, { setUser, setPermissions, setCurrentOrganization, setOrganizations })
        setMessage('登录成功，正在跳转…')
        router.replace(pending.returnUrl || '/dashboard/overview')
      } catch (error: any) {
        setMessage(error?.response?.data?.message || error?.message || 'SSO 登录失败')
      }
    }
    void run()
  }, [router, searchParams, setCurrentOrganization, setOrganizations, setPermissions, setUser])

  return (
    <div
      className='flex min-h-svh items-center justify-center bg-background px-6 text-foreground'
    >
      <div className='w-full max-w-[360px] text-center'>
        <Loader2 className='mx-auto mb-4 h-5 w-5 animate-spin text-muted-foreground' />
        <p className='text-[13px] text-muted-foreground'>{message}</p>
        <a className='mt-6 inline-block text-[13px] text-[var(--seal)] hover:underline' href='/login'>
          返回登录页
        </a>
      </div>
    </div>
  )
}

function applyLoginResponse(
  response: LoginResponseWithOrgs,
  stores: {
    setUser: (user: NonNullable<LoginResponseWithOrgs['user']>) => void
    setPermissions: (permissions: string[]) => void
    setCurrentOrganization: (organization: NonNullable<LoginResponseWithOrgs['organizations']>[number]) => void
    setOrganizations: (organizations: NonNullable<LoginResponseWithOrgs['organizations']>) => void
  },
) {
  if (response.user) {
    stores.setPermissions(response.user.permissions || [])
    stores.setUser(response.user)
  }
  if (response.organizations) {
    stores.setOrganizations(response.organizations)
    const current =
      response.organizations.find((org) => org.id === response.currentOrganizationId) ||
      (response.organizations.length === 1 ? response.organizations[0] : undefined)
    if (current) stores.setCurrentOrganization(current)
  }
}
