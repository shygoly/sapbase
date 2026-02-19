/**
 * Login Page
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/core/store'
import { useOrganizationStore } from '@/core/store/organization.store'
import { useNotification } from '@/core/ui/ui-hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, LogIn, Building2 } from 'lucide-react'
import { authApi } from '@/lib/api/auth.api'
import { Organization } from '@/lib/api/organizations.api'

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

export default function LoginPage() {
  const [selectedUser, setSelectedUser] = useState<string>('admin@example.com')
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('123456')
  const [isLoading, setIsLoading] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [showOrgSelector, setShowOrgSelector] = useState(false)
  const { login } = useAuthStore()
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      notification.error('Please enter email and password')
      return
    }

    setIsLoading(true)
    try {
      // Login without organization first to get organizations list
      const response = await authApi.login({ email, password, organizationId: selectedOrgId || undefined })
      
      // If user has multiple organizations and none selected, show selector
      if (response.organizations && response.organizations.length > 1 && !selectedOrgId) {
        setOrganizations(response.organizations)
        setShowOrgSelector(true)
        setIsLoading(false)
        return
      }

      // Store organizations and current organization
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

      // Call login store method to update auth state (organizations already set above)
      await login(email, password, selectedOrgId || undefined)
      
      notification.success('Login successful')
      
      // Redirect to returnUrl or default page
      const returnUrl = searchParams?.get('returnUrl') || '/admin/users'
      router.push(returnUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      notification.error(message)
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
      // Login with selected organization
      const response = await authApi.login({ email, password, organizationId: selectedOrgId })
      
      // Store organizations and current organization
      if (response.organizations) {
        setOrgStore(response.organizations)
        if (response.currentOrganizationId) {
          const currentOrg = response.organizations.find(org => org.id === response.currentOrganizationId)
          if (currentOrg) {
            setCurrentOrganization(currentOrg)
          }
        }
      }

      // Call login store method to update auth state (organizations already set above)
      await login(email, password, selectedOrgId)
      
      notification.success('Login successful')
      
      // Redirect to returnUrl or default page
      const returnUrl = searchParams?.get('returnUrl') || '/admin/users'
      router.push(returnUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      notification.error(message)
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
                        <span className="text-xs text-muted-foreground">{user.email} ({user.role})</span>
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
                  placeholder="••••••••"
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
