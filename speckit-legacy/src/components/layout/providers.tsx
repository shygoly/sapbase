'use client';

import { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Providers Component
 *
 * Wraps the application with necessary context providers.
 * This is a placeholder that can be extended with actual providers
 * as they are implemented in the core modules.
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <>
      {children}
    </>
  );
}
