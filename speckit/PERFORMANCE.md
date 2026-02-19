# Frontend Performance Optimization Guide

This document outlines the performance optimizations implemented in the Speckit frontend application.

## 1. Code Splitting (Code Splitting)

### Dynamic Imports
Heavy components are dynamically imported to reduce initial bundle size:

```tsx
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(
  () => import('./heavy-component'),
  {
    loading: () => <Skeleton />,
    ssr: false
  }
);
```

### Route-based Code Splitting
Next.js automatically splits code by route. Each page is loaded only when needed.

### Component-level Code Splitting
Use `dynamic()` for components that are:
- Large (>50KB)
- Conditionally rendered
- Not needed on initial load

## 2. Service-side Caching Strategy

### Next.js Cache Headers
Configured in `next.config.ts` and `middleware.ts`:

- **Static assets**: `Cache-Control: public, max-age=31536000, immutable`
- **API routes**: `Cache-Control: private, max-age=60, stale-while-revalidate=300`
- **Images**: `Cache-Control: public, max-age=31536000, immutable`

### Client-side Caching
Use `cachedApi` for API calls with automatic caching:

```tsx
import { cachedApi } from '@/lib/api/cached-api';

// Automatically cached for 5 minutes
const user = await cachedApi.get('/api/users/123');

// Clear cache when needed
cachedApi.clearCache('/api/users');
```

### Cache Utilities
Located in `src/lib/utils/cache.ts`:
- TTL-based expiration
- Memory-efficient storage
- Type-safe cache keys

## 3. Image Optimization

### OptimizedImage Component
Use the `OptimizedImage` component instead of regular `<img>` tags:

```tsx
import { OptimizedImage } from '@/components/ui/optimized-image';

<OptimizedImage
  src="/hero.jpg"
  alt="Hero image"
  width={1200}
  height={600}
  priority={true} // For above-the-fold images
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>
```

### Next.js Image Optimization
Configured in `next.config.ts`:
- Automatic format conversion (AVIF/WebP)
- Responsive sizing
- Lazy loading by default
- Blur placeholders

### Image Best Practices
1. Use `priority` prop for above-the-fold images
2. Provide `sizes` prop for responsive images
3. Use blur placeholders for better UX
4. Optimize images before uploading (compress, resize)

## 4. Resource Preloading

### ResourcePreloader Component
Preload critical resources:

```tsx
import { ResourcePreloader } from '@/components/performance/resource-preloader';

<ResourcePreloader
  urls={['/api/critical-data']}
  routes={['/dashboard', '/settings']}
  images={['/hero-image.jpg']}
/>
```

### Route Prefetching
Use `useRoutePrefetch` hook for on-hover prefetching:

```tsx
import { useRoutePrefetch } from '@/components/performance/resource-preloader';

const prefetchRoute = useRoutePrefetch();

<Link
  href="/dashboard"
  onMouseEnter={() => prefetchRoute('/dashboard')}
>
  Dashboard
</Link>
```

## 5. Performance Monitoring

### Performance Monitor
Track performance metrics:

```tsx
import { performanceMonitor } from '@/lib/utils/performance';

// Measure function execution
const result = await performanceMonitor.measure(
  'fetchUser',
  () => fetchUser(userId)
);

// Get metrics
const metrics = performanceMonitor.getMetrics();
const average = performanceMonitor.getAverage('fetchUser');
```

### Component Performance
Use `usePerformanceMeasure` hook:

```tsx
import { usePerformanceMeasure } from '@/hooks/use-performance-measure';

function MyComponent() {
  usePerformanceMeasure('MyComponent');
  // component code
}
```

## 6. Best Practices

### Bundle Size Optimization
- Use dynamic imports for large dependencies
- Tree-shake unused code
- Use `optimizePackageImports` in Next.js config
- Analyze bundle with `@next/bundle-analyzer`

### Rendering Optimization
- Use `React.memo` for expensive components
- Implement `useMemo` and `useCallback` appropriately
- Avoid unnecessary re-renders
- Use Suspense for async components

### Network Optimization
- Minimize API calls (use caching)
- Batch requests when possible
- Use compression (gzip/brotli)
- Implement request deduplication

### Image Optimization Checklist
- [ ] Use Next.js Image component
- [ ] Provide appropriate sizes
- [ ] Use modern formats (AVIF/WebP)
- [ ] Implement lazy loading
- [ ] Add blur placeholders
- [ ] Optimize before upload

## 7. Monitoring and Analytics

### Web Vitals
Track Core Web Vitals:
- Largest Contentful Paint (LCP)
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)

### Performance Budgets
Set performance budgets:
- Initial bundle: <200KB
- Total bundle: <500KB
- LCP: <2.5s
- FID: <100ms
- CLS: <0.1

## 8. Tools and Resources

### Development Tools
- Next.js Bundle Analyzer
- Chrome DevTools Performance tab
- Lighthouse
- WebPageTest

### Performance Testing
```bash
# Analyze bundle
npm run build
npm run analyze

# Run Lighthouse
npx lighthouse http://localhost:3050
```

## 9. Future Optimizations

- [ ] Implement Service Worker for offline support
- [ ] Add HTTP/2 Server Push
- [ ] Implement Resource Hints (preconnect, prefetch)
- [ ] Add Progressive Web App (PWA) support
- [ ] Implement Virtual Scrolling for long lists
- [ ] Add Request Deduplication
- [ ] Implement Optimistic UI Updates
