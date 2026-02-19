import { useEffect } from 'react';
import { performanceMonitor } from '@/lib/utils/performance';

/**
 * React hook to measure component render performance.
 * 
 * Usage:
 * ```tsx
 * import { usePerformanceMeasure } from '@/hooks/use-performance-measure';
 * 
 * function MyComponent() {
 *   usePerformanceMeasure('MyComponent');
 *   // component code
 * }
 * ```
 */
export function usePerformanceMeasure(componentName: string): void {
  useEffect(() => {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      performanceMonitor.recordMetric({
        name: `render:${componentName}`,
        value: duration,
        unit: 'ms',
        timestamp: Date.now(),
      });
    };
  }, [componentName]);
}
