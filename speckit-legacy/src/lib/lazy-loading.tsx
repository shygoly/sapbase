'use client'

import { Suspense, lazy, ReactNode } from 'react'

interface LazyComponentProps {
  children: ReactNode
  fallback?: ReactNode
}

export function LazyBoundary({ children, fallback }: LazyComponentProps) {
  return <Suspense fallback={fallback || <div className="p-4">Loading...</div>}>{children}</Suspense>
}

export function lazyComponent<P extends object>(
  importFunc: () => Promise<{ default: React.ComponentType<P> }>,
  fallback?: ReactNode
) {
  const Component = lazy(importFunc)

  return function LazyComponent(props: P) {
    return (
      <Suspense fallback={fallback || <div className="p-4">Loading...</div>}>
        <Component {...props} />
      </Suspense>
    )
  }
}
