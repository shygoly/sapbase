/**
 * Auth Hooks
 * Custom hooks for authentication
 */

import { useEffect } from 'react'
import { useAuthStore } from '@/core/store'
import { useRouter } from 'next/navigation'

/**
 * useAuth - Get current user and auth state
 */
export function useAuth() {
  const { user, isLoading, error, isAuthenticated } = useAuthStore()
  return { user, isLoading, error, isAuthenticated }
}

/**
 * useLogin - Login hook
 */
export function useLogin() {
  const { login, isLoading, error } = useAuthStore()
  return { login, isLoading, error }
}

/**
 * useLogout - Logout hook
 */
export function useLogout() {
  const { logout, isLoading } = useAuthStore()
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return { logout: handleLogout, isLoading }
}

/**
 * useRequireAuth - Redirect to login if not authenticated
 */
export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  return { isAuthenticated, isLoading }
}

/**
 * useInitializeAuth - Initialize auth on app load
 */
export function useInitializeAuth() {
  const { initializeAuth, isAuthenticated } = useAuthStore()

  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  return { isAuthenticated }
}
