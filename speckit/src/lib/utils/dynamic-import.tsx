import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

/**
 * Utility for creating dynamic imports with loading states and error boundaries.
 * 
 * Usage:
 * ```tsx
 * const HeavyComponent = dynamicImport(() => import('./heavy-component'), {
 *   loading: () => <Skeleton />,
 *   ssr: false
 * });
 * ```
 */
export function dynamicImport<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options?: {
    loading?: () => JSX.Element | null;
    ssr?: boolean;
  }
) {
  return dynamic(importFn, {
    loading: options?.loading,
    ssr: options?.ssr ?? true,
  });
}

/**
 * Preload a component for faster subsequent loads.
 * 
 * Usage:
 * ```tsx
 * // Preload when user hovers over a button
 * <button onMouseEnter={() => preloadComponent(() => import('./modal'))}>
 *   Open Modal
 * </button>
 * ```
 */
export function preloadComponent(
  importFn: () => Promise<any>
): void {
  importFn();
}
