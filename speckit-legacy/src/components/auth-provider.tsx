"use client"

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import { AuthContext, type AuthContextType } from "@/core/auth/context"
import type { Session, User } from "@/core/auth/types"
import { authService } from "@/lib/auth-service"

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const setAuthedSession = useCallback((nextUser: User) => {
    const token = authService.getToken()
    if (!token) return

    const nextSession: Session = {
      user: nextUser,
      token,
      // best-effort; backend doesn't return expiry in response today
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    }

    setUser(nextUser)
    setSession(nextSession)
  }, [])

  const refreshSession = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const token = authService.getToken()
    if (!token) {
      setUser(null)
      setSession(null)
      setIsLoading(false)
      return
    }

    const profile = await authService.getProfile()
    if (!profile) {
      authService.clearToken()
      setUser(null)
      setSession(null)
      setIsLoading(false)
      return
    }

    // Map backend profile into core User shape (minimal fields)
    const mapped: User = {
      id: profile.userId,
      name: profile.email?.split("@")[0] || profile.email,
      email: profile.email,
      role: profile.role,
      permissions: profile.permissions || [],
      organizationId: "default",
      dataScope: "all",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    setAuthedSession(mapped)
    setIsLoading(false)
  }, [setAuthedSession])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await authService.login(email, password)
      const mapped: User = {
        id: res.user.id,
        name: res.user.name,
        email: res.user.email,
        role: res.user.role,
        permissions: res.user.permissions || [],
        organizationId: "default",
        dataScope: "all",
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      setAuthedSession(mapped)
    } catch (e) {
      const message = e instanceof Error ? e.message : "Login failed"
      setError(message)
      authService.clearToken()
      setUser(null)
      setSession(null)
      throw e
    } finally {
      setIsLoading(false)
    }
  }, [setAuthedSession])

  const logout = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      await authService.logout()
    } finally {
      authService.clearToken()
      setUser(null)
      setSession(null)
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshSession()
  }, [refreshSession])

  const authValue: AuthContextType = useMemo(() => {
    return {
      user,
      session,
      isAuthenticated: !!user && !!authService.getToken(),
      isLoading,
      error,
      login,
      logout,
      refreshSession,
    }
  }, [user, session, isLoading, error, login, logout, refreshSession])

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  )
}
