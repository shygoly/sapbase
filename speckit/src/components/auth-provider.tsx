"use client"

import { ReactNode } from "react"
import { AuthContext, type AuthContextType } from "@/core/auth/context"

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  // TODO: Implement actual auth logic
  const authValue: AuthContextType = {
    user: null,
    session: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    login: async () => {},
    logout: async () => {},
    refreshSession: async () => {}
  }

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  )
}
