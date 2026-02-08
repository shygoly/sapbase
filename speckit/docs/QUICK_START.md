# Quick Start Guide - Phase 5

## 5-Minute Setup

### 1. Update Root Layout

```typescript
// app/layout.tsx
import { RootProviders } from '@/components/root-providers'
import { AdminLayout } from '@/components/admin-layout'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <RootProviders>
          <AdminLayout>{children}</AdminLayout>
        </RootProviders>
      </body>
    </html>
  )
}
```

### 2. Enable Tailwind Dark Mode

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  // ... rest of config
}
```

### 3. Start Using Features

```typescript
// Example component
'use client'

import { useTranslation } from '@/core/i18n/hooks'
import { useTheme } from '@/core/theme/hooks'
import { useNotification } from '@/core/notification/hooks'

export function MyComponent() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { success } = useNotification()

  return (
    <div>
      <h1>{t('common.save')}</h1>
      <p>Current theme: {theme}</p>
      <button onClick={() => success('Done!')}>
        Show Notification
      </button>
    </div>
  )
}
```

## Common Patterns

### Form with Validation

```typescript
import { useForm } from '@/lib/hooks'
import { isEmail } from '@/lib'

const { values, errors, handleChange, handleSubmit } = useForm(
  { email: '' },
  async (values) => await submitForm(values),
  (values) => ({
    email: !isEmail(values.email) ? 'Invalid email' : '',
  })
)
```

### Data Fetching with Caching

```typescript
import { useCache } from '@/lib/hooks'

const { data, loading, error, revalidate } = useCache(
  'users',
  () => fetch('/api/users').then(r => r.json()),
  { ttl: 5 * 60 * 1000 }
)
```

### List with Pagination

```typescript
import { usePagination, useFetch } from '@/lib/hooks'

const { page, pageSize, nextPage, prevPage } = usePagination(10)
const { data } = useFetch(`/api/users?page=${page}&pageSize=${pageSize}`)
```

## Available Imports

```typescript
// Hooks
import { useI18n, useTranslation } from '@/core/i18n/hooks'
import { useTheme } from '@/core/theme/hooks'
import { useError } from '@/core/error/hooks'
import { useNotification } from '@/core/notification/hooks'
import { useMenu } from '@/core/menu/hooks'

// Custom Hooks
import {
  useCache,
  useFetch,
  useForm,
  useApiErrorHandler,
  useToggle,
  useModal,
  useAsync,
  useLocalStorage,
  usePagination,
} from '@/lib/hooks'

// Utilities
import {
  formatDate,
  formatCurrency,
  isEmail,
  isPhone,
  unique,
  groupBy,
  sortBy,
  debounce,
  throttle,
  cache,
} from '@/lib'

// Components
import { RootProviders } from '@/components/root-providers'
import { AdminLayout } from '@/components/admin-layout'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageSwitcher } from '@/components/language-switcher'
import { ErrorBoundary } from '@/components/error-boundary'
import { NotificationContainer } from '@/components/notification-container'
```

## Troubleshooting

### Hooks not working?
- Ensure component is wrapped with RootProviders
- Check that you're using 'use client' directive

### Translations not loading?
- Verify translation files exist in `src/core/i18n/translations/`
- Check language code matches SUPPORTED_LANGUAGES

### Theme not persisting?
- Ensure localStorage is enabled
- Check browser console for errors

### Notifications not showing?
- Verify NotificationContainer is rendered (included in RootProviders)
- Check notification duration is not 0

## Performance Tips

1. Use `useCache` for frequently accessed data
2. Use `debounce` for search inputs
3. Use `throttle` for scroll events
4. Use lazy loading for heavy components
5. Use `usePagination` for large lists

## Next: Create Admin Pages

After setup, create admin pages:
- `/admin/users` - User management
- `/admin/roles` - Role management
- `/admin/departments` - Department management
- `/admin/audit-logs` - Audit logs
- `/admin/settings` - System settings

See Phase 4 reference implementation for examples.
