'use client'

/**
 * LoginSurface —— Portal / Console 共用的登录表面。
 *
 * 契约见 openspec/changes/redesign-auth-login-surfaces：
 *  - 单栏表单为主，禁止蓝紫渐变与营销装饰；
 *  - 样式全部走设计 token；
 *  - 两台面仅以标题/副文案区分；
 *  - 开发态测试账号仅非生产可见，且不抢主层级。
 */

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, Loader2, ShieldCheck } from 'lucide-react'

import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../../components/ui/select'
import { useAuthStore } from '../../../core/store'
import { useOrganizationStore } from '../../../core/store/organization.store'
import { usePermissionStore } from '../../../core/store/permission.store'
import { useNotification } from '../../../core/ui/ui-hooks'
import {
  authApi,
  type LoginResponseWithOrgs,
  type SsoProvider
} from '../../../lib/api/auth.api'
import type { Organization } from '../../../lib/api/organizations.api'

export type LoginSurfaceKind = 'portal' | 'console'

interface LoginSurfaceProps {
  surface: LoginSurfaceKind
  defaultRedirect?: string
}

interface TestUser {
  email: string
  password: string
  name: string
  role: string
}

const TEST_USERS: TestUser[] = [
  { email: 'admin@example.com', password: '123456', name: 'Admin User', role: 'Admin' },
  { email: 'sales@example.com', password: '123456', name: 'Sales User', role: 'Sales' },
  { email: 'manager@example.com', password: '123456', name: 'Manager User', role: 'Manager' },
  { email: 'accountant@example.com', password: '123456', name: 'Accountant User', role: 'Accountant' }
]

const SSO_PENDING_KEY = 'sso:pending'

const SURFACE_COPY: Record<LoginSurfaceKind, { title: string; subtitle: string }> = {
  portal: {
    title: 'Sign in to your workspace',
    subtitle: 'Tenant workspace'
  },
  console: {
    title: 'Sign in to the platform console',
    subtitle: 'Platform governance'
  }
}

function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return Array.from(buffer, (value) => value.toString(16).padStart(2, '0')).join('')
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function LoginSurface({
  surface,
  defaultRedirect = '/admin/users'
}: LoginSurfaceProps) {
  const [selectedUser, setSelectedUser] = useState<string>('admin@example.com')
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('123456')
  const [isLoading, setIsLoading] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [showOrgSelector, setShowOrgSelector] = useState(false)
  const [ssoProviders, setSsoProviders] = useState<SsoProvider[]>([])
  const [ssoLoading, setSsoLoading] = useState(false)

  const { setUser } = useAuthStore()
  const setPermissions = usePermissionStore((state) => state.setPermissions)
  const { setCurrentOrganization, setOrganizations: setOrgStore } = useOrganizationStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const notification = useNotification()

  const showDevUsers = process.env.NODE_ENV !== 'production'
  const copy = SURFACE_COPY[surface]

  useEffect(() => {
    // Auto-fill form when user selection changes
    const user = TEST_USERS.find((u) => u.email === selectedUser)
    if (user) {
      setEmail(user.email)
      setPassword(user.password)
    }
  }, [selectedUser])

  const ssoOrganizationId =
    searchParams?.get('organizationId') ||
    process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID ||
    (typeof window !== 'undefined' ? localStorage.getItem('currentOrganizationId') : null) ||
    ''

  useEffect(() => {
    let cancelled = false
    if (!ssoOrganizationId) return
    authApi
      .ssoProviders(ssoOrganizationId)
      .then((providers) => {
        if (!cancelled) setSsoProviders(providers)
      })
      .catch(() => {
        if (!cancelled) setSsoProviders([])
      })
    return () => {
      cancelled = true
    }
  }, [ssoOrganizationId])

  const handleSsoLogin = async (provider: SsoProvider) => {
    setSsoLoading(true)
    try {
      const state = randomToken(16)
      const nonce = randomToken(16)
      const codeVerifier = provider.type === 'oidc' ? randomToken(48) : ''
      const codeChallenge = codeVerifier ? await pkceChallenge(codeVerifier) : undefined
      sessionStorage.setItem(
        SSO_PENDING_KEY,
        JSON.stringify({
          providerKey: provider.key,
          organizationId: ssoOrganizationId,
          state,
          nonce,
          codeVerifier,
          returnUrl: searchParams?.get('returnUrl') || defaultRedirect
        })
      )
      const { url } = await authApi.ssoAuthorize(ssoOrganizationId, provider.key, {
        state,
        nonce,
        codeChallenge
      })
      window.location.assign(url)
    } catch (error: any) {
      notification.error(error?.message || 'SSO sign-in failed to start')
      setSsoLoading(false)
    }
  }

  const applyLoginResponse = (response: LoginResponseWithOrgs) => {
    if (response.user) {
      setPermissions(response.user.permissions || [])
      setUser(response.user)
    }

    if (response.organizations) {
      setOrgStore(response.organizations)
      if (response.currentOrganizationId) {
        const currentOrg = response.organizations.find((org) => org.id === response.currentOrganizationId)
        if (currentOrg) {
          setCurrentOrganization(currentOrg)
        }
      } else if (response.organizations.length === 1) {
        setCurrentOrganization(response.organizations[0])
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      notification.error('Please enter email and password')
      return
    }

    setIsLoading(true)
    try {
      const response = await authApi.login({
        email,
        password,
        organizationId: selectedOrgId || undefined
      })

      if (!response.organizations || response.organizations.length === 0) {
        notification.error(
          'Your account is not associated with any organization. Please contact your administrator.'
        )
        setIsLoading(false)
        return
      }

      if (response.organizations.length > 1 && !selectedOrgId) {
        setOrganizations(response.organizations)
        setShowOrgSelector(true)
        setIsLoading(false)
        return
      }

      applyLoginResponse(response)
      notification.success('Login successful')

      const returnUrl = searchParams?.get('returnUrl') || defaultRedirect
      router.push(returnUrl)
    } catch (error: any) {
      let errorMessage = 'Login failed'
      if (error?.response?.data?.message) {
        const backendMessage = error.response.data.message
        if (Array.isArray(backendMessage)) {
          errorMessage = backendMessage.join(', ')
        } else {
          errorMessage = backendMessage
        }
      } else if (error?.message) {
        errorMessage = error.message
      }
      notification.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOrgSelectAndLogin = async () => {
    if (!selectedOrgId) {
      notification.error('Please select an organization')
      return
    }

    setIsLoading(true)
    try {
      const response = await authApi.login({ email, password, organizationId: selectedOrgId })
      applyLoginResponse(response)

      notification.success('Login successful')

      const returnUrl = searchParams?.get('returnUrl') || defaultRedirect
      router.push(returnUrl)
    } catch (error: any) {
      let errorMessage = 'Login failed'
      if (error?.response?.data?.message) {
        const backendMessage = error.response.data.message
        if (Array.isArray(backendMessage)) {
          errorMessage = backendMessage.join(', ')
        } else {
          errorMessage = backendMessage
        }
      } else if (error?.message) {
        errorMessage = error.message
      }
      notification.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const ssoButtons = ssoProviders.filter(
    (provider) => provider.type === 'cas' || provider.type === 'oidc'
  )

  return (
    <div
      className='flex min-h-svh items-center justify-center bg-background px-6 py-10 text-foreground'
    >
      <div className='w-full max-w-[360px]'>
        {/* Brand */}
        <div className='mb-11 flex items-center gap-2.5'>
          <span aria-hidden className='h-5 w-5 rounded-[3px] bg-[var(--seal)]' />
          <span className='font-serif text-[21px] leading-none tracking-[-0.02em]'>sapbase</span>
          <span className='ml-auto text-[11px] text-muted-foreground'>{copy.subtitle}</span>
        </div>

        <h1 className='text-[26px] leading-[1.15] font-semibold tracking-[-0.015em]'>
          {copy.title}
        </h1>
        <p className='mt-2 text-[13px] text-muted-foreground'>
          Use your work email to continue.
        </p>

        {showOrgSelector ? (
          <div className='mt-7 flex flex-col gap-6'>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='org-select' className='text-[12px] text-muted-foreground'>
                Organization
              </Label>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId} disabled={isLoading}>
                <SelectTrigger id='org-select' className='h-10 w-full'>
                  <SelectValue placeholder='Select an organization'>
                    {selectedOrgId ? (
                      <div className='flex items-center gap-2'>
                        <Building2 className='h-4 w-4' />
                        <span>{organizations.find((org) => org.id === selectedOrgId)?.name}</span>
                      </div>
                    ) : (
                      <span>Select an organization</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      <div className='flex flex-col'>
                        <span className='font-medium'>{org.name}</span>
                        <span className='text-xs text-muted-foreground'>
                          {org.planName || 'Free Plan'}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='flex gap-2'>
              <Button
                variant='outline'
                onClick={() => {
                  setShowOrgSelector(false)
                  setSelectedOrgId('')
                  setOrganizations([])
                }}
                disabled={isLoading}
                className='h-10 flex-1'
              >
                Back
              </Button>
              <Button
                onClick={handleOrgSelectAndLogin}
                disabled={isLoading || !selectedOrgId}
                className='h-10 flex-1'
              >
                {isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                {isLoading ? 'Signing in…' : 'Continue'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* 开发态快捷账号：非生产可见，视觉上退到主表单之后 */}
            {showDevUsers ? (
              <div className='mt-7 rounded-md border border-dashed border-border px-3 py-2.5'>
                <div className='mb-1.5 text-[11px] font-medium tracking-[0.02em] text-muted-foreground'>
                  Development accounts
                </div>
                <Select value={selectedUser} onValueChange={setSelectedUser} disabled={isLoading}>
                  <SelectTrigger
                    id='user-select'
                    className='h-8 w-full border-0 bg-transparent px-0 text-[13px] shadow-none'
                  >
                    <SelectValue placeholder='Select a user'>
                      {TEST_USERS.find((user) => user.email === selectedUser)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TEST_USERS.map((user) => (
                      <SelectItem key={user.email} value={user.email}>
                        <div className='flex flex-col'>
                          <span className='font-medium'>{user.name}</span>
                          <span className='text-xs text-muted-foreground'>
                            {user.email} ({user.role ?? 'user'})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className='mt-7 flex flex-col gap-4'>
              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='email' className='text-[12px] font-medium text-muted-foreground'>
                  Email
                </Label>
                <Input
                  id='email'
                  type='email'
                  autoComplete='email'
                  placeholder='name@company.com'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className='h-10'
                />
              </div>

              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='password' className='text-[12px] font-medium text-muted-foreground'>
                  Password
                </Label>
                <Input
                  id='password'
                  type='password'
                  autoComplete='current-password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className='h-10'
                />
              </div>

              <Button type='submit' disabled={isLoading} className='mt-2 h-10 w-full'>
                {isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                {isLoading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            {ssoButtons.length > 0 ? (
              <div className='mt-7 flex flex-col gap-3'>
                <div className='flex items-center gap-3 text-[12px] text-muted-foreground'>
                  <span className='h-px flex-1 bg-border' />
                  or
                  <span className='h-px flex-1 bg-border' />
                </div>
                {ssoButtons.map((provider) => (
                  <Button
                    key={provider.key}
                    type='button'
                    variant='outline'
                    className='h-10 w-full'
                    disabled={isLoading || ssoLoading}
                    onClick={() => void handleSsoLogin(provider)}
                  >
                    {ssoLoading ? (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    ) : (
                      <ShieldCheck className='mr-2 h-4 w-4' />
                    )}
                    Continue with {provider.name}
                  </Button>
                ))}
              </div>
            ) : null}
          </>
        )}

        <div className='mt-10 flex items-center justify-between border-t border-border pt-4 text-[11px] text-muted-foreground'>
          <span>ERP Frontend Runtime v1.0</span>
          <span>© sapbase</span>
        </div>
      </div>
    </div>
  )
}
