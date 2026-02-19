'use client'

import { toast as sonnerToast } from 'sonner'

/**
 * Shadcn-style useToast hook that delegates to sonner.
 * Use for components that expect { toast: (opts) => void }.
 */
export function useToast() {
  return {
    toast: (opts: { title?: string; description?: string; variant?: 'default' | 'destructive' }) => {
      if (opts.variant === 'destructive') {
        sonnerToast.error(opts.title ?? opts.description ?? 'Error')
      } else {
        sonnerToast.success(opts.title ?? opts.description ?? 'Success')
      }
    },
  }
}
