# Phase 5 Integration Guide

## Overview

This guide walks through integrating Phase 5 system-level capabilities into your Speckit ERP application.

## Step 1: Install Dependencies

Ensure you have the required packages:

```bash
npm install lucide-react react-hook-form
```

## Step 2: Update Root Layout

Update `app/layout.tsx`:

```typescript
'use client'

import { RootProviders } from '@/components/root-providers'
import { AdminLayout } from '@/components/admin-layout'
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProviders>
          <AdminLayout>{children}</AdminLayout>
        </RootProviders>
      </body>
    </html>
  )
}
```

## Step 3: Configure Tailwind

Update `tailwind.config.js`:

```javascript
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

## Step 4: Create Environment File

Create `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEBUG=true
```

## Step 5: Test Integration

Create a test page `app/admin/test/page.tsx`:

```typescript
'use client'

import { useTranslation } from '@/core/i18n/hooks'
import { useTheme } from '@/core/theme/hooks'
import { useNotification } from '@/core/notification/hooks'

export default function TestPage() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { success, error } = useNotification()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('common.save')}</h1>
      <p>Current theme: {theme}</p>
      <button
        onClick={() => success('Success', 'This is a success notification')}
        className="px-4 py-2 bg-green-600 text-white rounded"
      >
        Show Success
      </button>
      <button
        onClick={() => error('Error', 'This is an error notification')}
        className="px-4 py-2 bg-red-600 text-white rounded"
      >
        Show Error
      </button>
    </div>
  )
}
```

## Step 6: Create Admin Pages

Create pages for each module:

### Users Page

`app/admin/users/page.tsx`:

```typescript
'use client'

import { useFetch, usePagination } from '@/lib/hooks'
import { useTranslation } from '@/core/i18n/hooks'

export default function UsersPage() {
  const { t } = useTranslation()
  const { page, pageSize, nextPage, prevPage, hasNextPage, hasPrevPage } = usePagination(10)
  const { data, loading } = useFetch(`/api/users?page=${page}&pageSize=${pageSize}`)

  if (loading) return <div>{t('common.loading')}</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t('users.title')}</h1>
      {/* User list implementation */}
      <div className="flex gap-2 mt-4">
        <button onClick={prevPage} disabled={!hasPrevPage}>
          Previous
        </button>
        <span>Page {page}</span>
        <button onClick={nextPage} disabled={!hasNextPage}>
          Next
        </button>
      </div>
    </div>
  )
}
```

### Roles Page

`app/admin/roles/page.tsx`:

```typescript
'use client'

import { useTranslation } from '@/core/i18n/hooks'

export default function RolesPage() {
  const { t } = useTranslation()

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('roles.title')}</h1>
      {/* Role management implementation */}
    </div>
  )
}
```

### Departments Page

`app/admin/departments/page.tsx`:

```typescript
'use client'

import { useTranslation } from '@/core/i18n/hooks'

export default function DepartmentsPage() {
  const { t } = useTranslation()

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('departments.title')}</h1>
      {/* Department management implementation */}
    </div>
  )
}
```

## Step 7: Verify All Features

### Test i18n

```typescript
import { useTranslation } from '@/core/i18n/hooks'

export function TestI18n() {
  const { t, language } = useTranslation()
  return <div>{t('common.save')} - {language}</div>
}
```

### Test Theme

```typescript
import { useTheme } from '@/core/theme/hooks'

export function TestTheme() {
  const { theme, setTheme } = useTheme()
  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Toggle Theme
    </button>
  )
}
```

### Test Notifications

```typescript
import { useNotification } from '@/core/notification/hooks'

export function TestNotifications() {
  const { success, error, warning, info } = useNotification()
  return (
    <div className="space-y-2">
      <button onClick={() => success('Success!')}>Success</button>
      <button onClick={() => error('Error!')}>Error</button>
      <button onClick={() => warning('Warning!')}>Warning</button>
      <button onClick={() => info('Info!')}>Info</button>
    </div>
  )
}
```

## Step 8: Add Translations

Add more translations to `src/core/i18n/translations/en.json`:

```json
{
  "dashboard": {
    "title": "Dashboard",
    "welcome": "Welcome to Speckit ERP"
  }
}
```

## Troubleshooting

### Issue: Hooks not working
**Solution**: Ensure component has `'use client'` directive and is wrapped with RootProviders

### Issue: Translations not loading
**Solution**: Check translation files exist and language code matches SUPPORTED_LANGUAGES

### Issue: Theme not persisting
**Solution**: Verify localStorage is enabled in browser

### Issue: Notifications not showing
**Solution**: Check NotificationContainer is rendered (included in RootProviders)

## Next Steps

1. Create admin pages for all modules
2. Implement form validation
3. Add permission checks
4. Create dashboard
5. Add advanced features

## Support

For issues or questions:
1. Check documentation in `docs/` folder
2. Review example implementations
3. Check browser console for errors
4. Verify environment variables are set
