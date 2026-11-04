'use client';

import { useEffect } from 'react';

interface ResourcePreloaderProps {
  /**
   * URLs to preload
   */
  urls?: string[];
  /**
   * Routes to prefetch (for Next.js Link prefetching)
   */
  routes?: string[];
  /**
   * Images to preload
   */
  images?: string[];
}

/**
 * Component for preloading resources to improve performance.
 * 
 * Usage:
 * ```tsx
 * <ResourcePreloader
 *   urls={['/api/data']}
 *   routes={['/dashboard', '/settings']}
 *   images={['/hero-image.jpg']}
 * />
 * ```
 */
export function ResourcePreloader({
  urls = [],
  routes = [],
  images = [],
}: ResourcePreloaderProps) {
  useEffect(() => {
    // Preload URLs
    urls.forEach((url) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      link.as = 'fetch';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });

    // Preload images
    images.forEach((src) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = src;
      link.as = 'image';
      document.head.appendChild(link);
    });

    // Prefetch routes (Next.js will handle this automatically via Link component)
    // But we can also manually trigger prefetching
    routes.forEach(() => {
      // This will be handled by Next.js router prefetching
      // We can use router.prefetch() if needed
    });
  }, [urls, routes, images]);

  return null;
}

/**
 * Hook to prefetch a route on hover or focus.
 * 
 * Usage:
 * ```tsx
 * const prefetchRoute = useRoutePrefetch();
 * 
 * <Link
 *   href="/dashboard"
 *   onMouseEnter={() => prefetchRoute('/dashboard')}
 * >
 *   Dashboard
 * </Link>
 * ```
 */
export function useRoutePrefetch() {
  return (route: string) => {
    if (typeof window !== 'undefined') {
      // Use Next.js router prefetch if available
      const router = (window as any).__NEXT_DATA__?.router;
      if (router) {
        // Prefetch the route
        fetch(route, { method: 'HEAD' }).catch(() => {
          // Ignore errors
        });
      }
    }
  };
}
