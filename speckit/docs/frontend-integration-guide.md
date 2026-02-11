# Frontend Integration Guide

This guide explains how to use the integrated template layout and theme system with Speckit's Runtime-First architecture.

## Overview

The frontend integration merges the `next-shadcn-dashboard-starter` template's polished UI components with Speckit's Runtime-First architecture. The template provides UI infrastructure (layouts, themes, components), while Speckit provides Runtime governance (auth, permissions, menu, page models).

## Key Principle

**Template provides UI/Layout infrastructure; Speckit provides Runtime/Schema-First governance.**

## Architecture

### Layout Structure

```
RootLayout (app/layout.tsx)
  └── AppProviders (theme, nuqs, root providers)
      └── LayoutRuntimeAdapter (admin layout)
          ├── UnifiedSidebar (menu from API)
          ├── Header (user nav, theme toggle)
          └── PageRuntime (page wrapper)
              └── CollectionRuntime / FormRuntime / DetailRuntime
```

### Theme System

The theme system integrates:
- **Template's ThemeProvider**: Advanced theme management with `next-themes`
- **Speckit's ActiveThemeProvider**: Theme persistence via cookies
- **Theme Runtime**: Unified API for theme operations

Usage:
```tsx
import { useThemeRuntime } from '@/core/theme';

function MyComponent() {
  const { themeMode, setThemeMode, activeTheme, setActiveTheme } = useThemeRuntime();
  // ...
}
```

### Layout Components

#### LayoutRuntimeAdapter

Wraps admin layouts with Runtime integration:

```tsx
import { LayoutRuntimeAdapter } from '@/layouts/layout-runtime-adapter';

export default function AdminLayout({ children }) {
  return (
    <LayoutRuntimeAdapter
      requiredPermissions={['users:read', 'roles:read']}
      requireAll={false}
    >
      {children}
    </LayoutRuntimeAdapter>
  );
}
```

#### UnifiedSidebar

Connects template sidebar to Speckit's MenuProvider:

```tsx
import { UnifiedSidebar } from '@/components/layout/unified-sidebar';

<UnifiedSidebar source="api" />
```

## Runtime-First Pattern

### PageRuntime Pattern

All pages must use `PageRuntime` wrapper:

```tsx
import { PageRuntime, type PageModel } from '@/components/runtime';

const MyPageModel: PageModel = {
  id: 'my-page',
  title: 'My Page',
  description: 'Page description',
  permissions: ['resource:read'],
};

export default function MyPage() {
  return (
    <PageRuntime model={MyPageModel}>
      <MyPageContent />
    </PageRuntime>
  );
}
```

### CollectionRuntime Pattern

Wrap tables/lists with `CollectionRuntime`:

```tsx
import { CollectionRuntime, type CollectionModel } from '@/components/runtime';

const MyCollectionModel: CollectionModel = {
  id: 'my-collection',
  name: 'My Collection',
  permissions: ['resource:read'],
};

<CollectionRuntime model={MyCollectionModel}>
  <DataTable columns={columns} data={data} />
</CollectionRuntime>
```

### FormRuntime Pattern

Wrap forms with `FormRuntime`:

```tsx
import { FormRuntime, type FormModel } from '@/components/runtime';

const MyFormModel: FormModel = {
  id: 'my-form',
  name: 'My Form',
  permissions: ['resource:create'],
};

<FormRuntime model={MyFormModel}>
  <Form>
    <FormField name="email" />
  </Form>
</FormRuntime>
```

### DetailRuntime Pattern

Wrap detail views with `DetailRuntime`:

```tsx
import { DetailRuntime, type DetailModel } from '@/components/runtime';

const MyDetailModel: DetailModel = {
  id: 'my-detail',
  name: 'My Detail',
  permissions: ['resource:read'],
};

<DetailRuntime model={MyDetailModel}>
  <DetailView data={data} />
</DetailRuntime>
```

## URL State Management

The integration uses `nuqs` for URL state management:

```tsx
import { useQueryState } from 'nuqs';

function MyComponent() {
  const [search, setSearch] = useQueryState('search', parseAsString);
  // ...
}
```

## Page Transitions

Page transitions are handled by `nextjs-toploader`, automatically integrated in `AppProviders`.

## Best Practices

1. **Always define PageModel first** - Schema-first approach
2. **Use Runtime wrappers** - Never use components directly without Runtime
3. **Enforce permissions** - Define permissions in models, not components
4. **Consistent structure** - Follow the Runtime-First pattern consistently

## Migration Checklist

When migrating existing pages:

- [ ] Define PageModel schema
- [ ] Wrap page with PageRuntime
- [ ] Wrap tables with CollectionRuntime
- [ ] Wrap forms with FormRuntime
- [ ] Remove duplicate header/description (handled by PageRuntime)
- [ ] Move action buttons to pageHeaderAction prop
- [ ] Test permissions and RBAC filtering

## Examples

See the following pages for reference:
- `/app/admin/users/page.tsx` - Users management with CollectionRuntime
- `/app/admin/settings/page.tsx` - Settings with FormRuntime
- `/app/admin/roles/page.tsx` - Roles with CollectionRuntime
