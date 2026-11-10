/**
 * Login Page
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@sap/app-shared/core/store'
import { useOrganizationStore } from '@sap/app-shared/core/store/organization.store'
import { useNotification } from '@sap/app-shared/core/ui/ui-hooks'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import { Label } from '@sap/app-shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@sap/app-shared/components/ui/select'
import { Loader2, LogIn, Building2, ShieldCheck } from 'lucide-react'
import {
  authApi,
  type LoginResponseWithOrgs,
  type SsoProvider,
} from '@sap/app-shared/lib/api/auth.api'
import { Organization } from '@sap/app-shared/lib/api/organizations.api'
import { usePermissionStore } from '@sap/app-shared/core/store/permission.store'

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
  { email: 'accountant@example.com', password: '123456', name: 'Accountant User', role: 'Accountant' },
]

const SSO_PENDING_KEY = 'sso:pending'

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

/**
 * Suspense 边界：Next 15 要求任何在预渲染期调用 `useSearchParams()` 的组件
 * 必须被包在边界内，否则整页的静态预渲染会失败（构建时报
 * "useSearchParams() should be wrapped in a suspense boundary"）。
 * 这里保留静态外壳，只让真正读 query 的部分走边界。
 */
export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  )
}

function LoginForm() {
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

  useEffect(() => {
    // Auto-fill form when user selection changes
    const user = TEST_USERS.find(u => u.email === selectedUser)
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
          returnUrl: searchParams?.get('returnUrl') || '/admin/users',
        }),
      )
      const { url } = await authApi.ssoAuthorize(ssoOrganizationId, provider.key, {
        state,
        nonce,
        codeChallenge,
      })
      window.location.assign(url)
    } catch (error: any) {
      notification.error(error?.message || 'SSO 登录启动失败')
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
        const currentOrg = response.organizations.find(org => org.id === response.currentOrganizationId)
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
      const response = await authApi.login({ email, password, organizationId: selectedOrgId || undefined })

      // Check if user has no organizations
      if (!response.organizations || response.organizations.length === 0) {
        notification.error('Your account is not associated with any organization. Please contact your administrator.')
        setIsLoading(false)
        return
      }

      // If user has multiple organizations and none selected, show selector
      if (response.organizations.length > 1 && !selectedOrgId) {
        setOrganizations(response.organizations)
        setShowOrgSelector(true)
        setIsLoading(false)
        return
      }

      applyLoginResponse(response)
      notification.success('Login successful')

      // Redirect to returnUrl or default page
      const returnUrl = searchParams?.get('returnUrl') || '/admin/users'
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

      // Redirect to returnUrl or default page
      const returnUrl = searchParams?.get('returnUrl') || '/admin/users'
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-lg bg-blue-600 p-3">
              <LogIn className="h-6 w-6 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
          <p className="mt-2 text-gray-600">Sign in to your account to continue</p>
        </div>

        {showOrgSelector ? (
          /* Organization Selection */
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="org-select">Select Organization</Label>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId} disabled={isLoading}>
                <SelectTrigger id="org-select" className="w-full h-10">
                  <SelectValue placeholder="Select an organization">
                    {selectedOrgId ? (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>{organizations.find(org => org.id === selectedOrgId)?.name}</span>
                      </div>
                    ) : (
                      <span>Select an organization</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{org.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {org.planName || 'Free Plan'}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowOrgSelector(false)
                  setSelectedOrgId('')
                  setOrganizations([])
                }}
                disabled={isLoading}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleOrgSelectAndLogin}
                disabled={isLoading || !selectedOrgId}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? 'Signing in...' : 'Continue'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* User Selector */}
            <div className="mb-6 space-y-2">
              <Label htmlFor="user-select">Select User</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser} disabled={isLoading}>
                <SelectTrigger id="user-select" className="w-full h-10">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {TEST_USERS.map((user) => (
                    <SelectItem key={user.email} value={user.email}>
                      <div className="flex flex-col">
                        <span className="font-medium">{user.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {user.email} ({user.role ?? 'user'})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="h-10"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-10"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 bg-blue-600 hover:bg-blue-700"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            {ssoProviders.filter((provider) => provider.type === 'cas' || provider.type === 'oidc').length > 0 ? (
              <div className="mt-6 space-y-3 border-t pt-6">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ShieldCheck className="h-4 w-4" />
                  <span>或使用组织统一身份登录</span>
                </div>
                {ssoProviders
                  .filter((provider) => provider.type === 'cas' || provider.type === 'oidc')
                  .map((provider) => (
                    <Button
                      key={provider.key}
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={isLoading || ssoLoading}
                      onClick={() => void handleSsoLogin(provider)}
                    >
                      {ssoLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      使用 {provider.name} 登录
                    </Button>
                  ))}
              </div>
            ) : null}
          </>
        )}

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-gray-600">
          ERP Frontend Runtime v1.0
        </p>
      </div>
    </div>
  )
}
