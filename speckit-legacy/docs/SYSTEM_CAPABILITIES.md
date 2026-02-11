# System-Level Capabilities Guide

## Overview

Phase 5 implements system-level capabilities and optimizations for the Speckit ERP Frontend Runtime, including internationalization (i18n), theme management, error handling, notifications, and performance optimization.

## Internationalization (i18n)

### Configuration

Located in `speckit/src/core/i18n/`:

- **config.ts**: Language constants and configuration
  - `SUPPORTED_LANGUAGES`: Object mapping language codes to display names
  - `Language`: Type for supported language codes
  - `i18nConfig`: Configuration object with default and fallback languages

### Usage

```typescript
import { useTranslation } from '@/core/i18n/hooks'

export function MyComponent() {
  const { t, language } = useTranslation()

  return <h1>{t('common.save')}</h1>
}
```

### Adding New Languages

1. Create translation file: `speckit/src/core/i18n/translations/[lang].json`
2. Add language to `SUPPORTED_LANGUAGES` in `config.ts`
3. Translations are loaded dynamically on language change

### Translation Structure

Translations use dot notation for nested keys:

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel"
  },
  "users": {
    "title": "Users"
  }
}
```

Access with: `t('common.save')` or `t('users.title')`

## Theme Management

### Configuration

Located in `speckit/src/core/theme/`:

- **types.ts**: Theme type definitions
- **themes/light.ts**: Light theme colors and radius
- **themes/dark.ts**: Dark theme colors and radius
- **context.ts**: Theme provider and context
- **hooks.ts**: `useTheme()` hook

### Usage

```typescript
import { useTheme } from '@/core/theme/hooks'

export function MyComponent() {
  const { theme, setTheme, colors } = useTheme()

  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Toggle Theme
    </button>
  )
}
```

### Theme Persistence

Theme preference is saved to localStorage and restored on page load.

### Customizing Colors

Edit `speckit/src/core/theme/themes/light.ts` or `dark.ts` to customize colors:

```typescript
export const lightTheme: ThemeConfig = {
  colors: {
    primary: '#0066cc',
    // ... other colors
  },
  radius: {
    md: '0.5rem',
    // ... other radius values
  }
}
```

## Error Handling

### Error Context

Located in `speckit/src/core/error/`:

- **context.ts**: Error provider and context
- **hooks.ts**: `useError()` hook

### Usage

```typescript
import { useError } from '@/core/error/hooks'

export function MyComponent() {
  const { addError, errors } = useError()

  try {
    // some operation
  } catch (error) {
    addError('Operation failed', {
      stack: error.stack,
      severity: 'error'
    })
  }
}
```

### Error Boundary

Wrap components to catch React errors:

```typescript
import { ErrorBoundary } from '@/components/error-boundary'

export function App() {
  return (
    <ErrorBoundary>
      <YourComponent />
    </ErrorBoundary>
  )
}
```

## Notifications

### Notification Context

Located in `speckit/src/core/notification/`:

- **context.ts**: Notification provider and context
- **hooks.ts**: `useNotification()` hook with convenience methods

### Usage

```typescript
import { useNotification } from '@/core/notification/hooks'

export function MyComponent() {
  const { success, error, warning, info } = useNotification()

  const handleSave = async () => {
    try {
      await saveData()
      success('Saved', 'Data saved successfully')
    } catch (err) {
      error('Error', 'Failed to save data')
    }
  }
}
```

### Notification Types

- `success`: Green notification for successful operations
- `error`: Red notification for errors
- `warning`: Yellow notification for warnings
- `info`: Blue notification for informational messages

### Auto-dismiss

Notifications auto-dismiss after 5 seconds by default. Customize with:

```typescript
success('Title', 'Message', 10000) // 10 seconds
```

## Performance Optimization

### Caching

Located in `speckit/src/lib/cache.ts`:

```typescript
import { cache } from '@/lib/cache'

// Set cache
cache.set('users', userData, 5 * 60 * 1000) // 5 minutes TTL

// Get cache
const data = cache.get('users')

// Check if exists
if (cache.has('users')) {
  // ...
}
```

### useCache Hook

Located in `speckit/src/lib/hooks/use-cache.ts`:

```typescript
import { useCache } from '@/lib/hooks/use-cache'

export function UserList() {
  const { data, loading, error, revalidate } = useCache(
    'users',
    () => fetchUsers(),
    { ttl: 5 * 60 * 1000 }
  )

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      {data?.map(user => <div key={user.id}>{user.name}</div>)}
      <button onClick={revalidate}>Refresh</button>
    </div>
  )
}
```

### Debounce and Throttle

Located in `speckit/src/lib/performance.ts`:

```typescript
import { debounce, throttle } from '@/lib/performance'

// Debounce: Wait for user to stop typing
const handleSearch = debounce((query: string) => {
  searchUsers(query)
}, 300)

// Throttle: Limit function calls
const handleScroll = throttle(() => {
  loadMoreData()
}, 1000)
```

### Lazy Loading

Located in `speckit/src/lib/lazy-loading.tsx`:

```typescript
import { lazyComponent, LazyBoundary } from '@/lib/lazy-loading'

const HeavyComponent = lazyComponent(
  () => import('@/components/heavy-component'),
  <div>Loading component...</div>
)

export function App() {
  return <HeavyComponent />
}
```

## Root Providers

The `RootProviders` component wraps all system-level providers:

```typescript
import { RootProviders } from '@/components/root-providers'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  )
}
```

This ensures all child components have access to:
- i18n (translations and language switching)
- Theme (light/dark mode)
- Error handling (error boundary and logging)
- Notifications (toast messages)

## UI Components

### ThemeToggle

Located in `speckit/src/components/theme-toggle.tsx`:

```typescript
import { ThemeToggle } from '@/components/theme-toggle'

export function Header() {
  return (
    <header>
      <ThemeToggle />
    </header>
  )
}
```

### LanguageSwitcher

Located in `speckit/src/components/language-switcher.tsx`:

```typescript
import { LanguageSwitcher } from '@/components/language-switcher'

export function Header() {
  return (
    <header>
      <LanguageSwitcher />
    </header>
  )
}
```

### NotificationContainer

Automatically rendered by `RootProviders`. Displays all active notifications.

## Best Practices

1. **Always wrap app with RootProviders** to ensure all system capabilities are available
2. **Use useCache for frequently accessed data** to reduce API calls
3. **Use debounce for search/filter inputs** to reduce server load
4. **Use lazy loading for heavy components** to improve initial load time
5. **Use error boundary for critical sections** to prevent full app crashes
6. **Use notifications for user feedback** instead of alerts
7. **Persist user preferences** (theme, language) to localStorage
8. **Test error scenarios** with error boundary and error logging
