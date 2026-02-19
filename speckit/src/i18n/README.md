# Internationalization (i18n) Guide

## Overview

This project supports multiple languages for international users. The i18n system is built using a custom solution optimized for Next.js 15.

## Supported Languages

- 🇺🇸 English (en) - Default
- 🇨🇳 Chinese (zh)
- 🇯🇵 Japanese (ja)
- 🇰🇷 Korean (ko)
- 🇪🇸 Spanish (es)
- 🇫🇷 French (fr)
- 🇩🇪 German (de)

## Architecture

### File Structure

```
src/i18n/
├── config.ts              # i18n configuration
├── messages/             # Translation files
│   ├── en.json
│   ├── zh.json
│   ├── ja.json
│   ├── ko.json
│   ├── es.json
│   ├── fr.json
│   └── de.json
├── hooks/
│   ├── use-translation.ts  # Translation hook
│   └── use-locale.ts       # Locale management hook
└── index.ts               # Exports
```

### Routing

URLs are prefixed with locale:
- `/en/dashboard` - English
- `/zh/dashboard` - Chinese
- `/ja/dashboard` - Japanese

## Usage

### Client Components

```tsx
'use client'

import { useTranslation } from '@/i18n'

export function MyComponent() {
  const t = useTranslation()
  
  return (
    <div>
      <h1>{t('common.appName')}</h1>
      <p>{t('common.loading')}</p>
    </div>
  )
}
```

### Server Components

```tsx
import { getTranslations } from '@/lib/utils/i18n'
import { cookies } from 'next/headers'

export default async function MyPage() {
  const cookieStore = await cookies()
  const locale = cookieStore.get('locale')?.value || 'en'
  const t = getTranslations(locale)
  
  return (
    <div>
      <h1>{t('common.appName')}</h1>
    </div>
  )
}
```

### Language Switcher

```tsx
import { LanguageSwitcher } from '@/components/i18n/language-switcher'

export function Header() {
  return (
    <header>
      <LanguageSwitcher />
    </header>
  )
}
```

## Adding Translations

### 1. Add to English (en.json)

```json
{
  "mySection": {
    "title": "My Title",
    "description": "My description"
  }
}
```

### 2. Add to Other Languages

Add the same structure to other language files with translated values.

### 3. Use in Components

```tsx
const t = useTranslation()
const title = t('mySection.title')
```

## Translation Keys

Translation keys use dot notation:
- `common.appName` → `common.appName`
- `auth.login` → `auth.login`
- `navigation.dashboard` → `navigation.dashboard`

## Parameters

Support for parameters in translations:

```json
{
  "welcome": "Welcome, {{name}}!"
}
```

```tsx
t('welcome', { name: 'John' }) // "Welcome, John!"
```

## Best Practices

1. **Use descriptive keys**: `auth.login` instead of `login`
2. **Group related translations**: Keep related translations in the same section
3. **Keep keys consistent**: Use the same key structure across languages
4. **Test all languages**: Ensure translations work in all supported languages
5. **Handle missing translations**: System falls back to key name if translation missing

## Language Detection

The system detects language from:
1. URL path (`/zh/dashboard`)
2. Cookie (`locale` cookie)
3. Browser `Accept-Language` header
4. Default locale (English)

## Persistence

User's language preference is saved in:
- Cookie: `locale`
- localStorage: `locale`

## Migration Guide

To migrate existing components:

1. Import `useTranslation` hook
2. Replace hardcoded strings with `t('key')`
3. Add translations to all language files
4. Test in different languages

Example:

```tsx
// Before
<h1>Dashboard</h1>

// After
const t = useTranslation()
<h1>{t('navigation.dashboard')}</h1>
```

## Troubleshooting

### Translation not found

- Check key exists in `en.json`
- Verify key spelling
- Check console for warnings

### Language not switching

- Clear cookies and localStorage
- Check middleware is running
- Verify locale is valid

### Missing translations

- Add missing keys to all language files
- Use English as fallback
- Check translation file structure
