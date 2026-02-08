import { ReactNode } from "react"

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-lg">
        {children}
      </div>
    </div>
  )
}
