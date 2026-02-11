# Component Patterns Guide

This guide documents the Runtime-First component patterns used in Speckit ERP.

## Overview

All components follow the Runtime-First architecture pattern, which enforces:
1. Schema-first definition
2. Runtime wrapper usage
3. RBAC permission enforcement
4. Consistent structure

## PageRuntime Pattern

### Purpose
Wraps entire pages with consistent structure, permissions, and loading states.

### Usage
```tsx
import { PageRuntime, type PageModel } from '@/components/runtime';

const MyPageModel: PageModel = {
  id: 'my-page',
  title: 'My Page Title',
  description: 'Page description',
  permissions: ['resource:read'],
  requireAll: false, // Optional: require ALL permissions (default: false = ANY)
};

export default function MyPage() {
  return (
    <PageRuntime 
      model={MyPageModel}
      isLoading={isLoading}
      pageHeaderAction={<Button>Action</Button>}
    >
      <MyPageContent />
    </PageRuntime>
  );
}
```

### Props
- `model: PageModel` - Required. Page schema definition
- `children: React.ReactNode` - Required. Page content
- `isLoading?: boolean` - Optional. Shows loading skeleton
- `pageHeaderAction?: React.ReactNode` - Optional. Action button in header

### PageModel Schema
```tsx
interface PageModel {
  id: string;                    // Unique page identifier
  title: string;                 // Page title
  description?: string;          // Page description
  permissions?: string[];        // Required permissions (OR logic by default)
  requireAll?: boolean;          // If true, requires ALL permissions (AND logic)
  accessDeniedFallback?: React.ReactNode; // Custom access denied UI
}
```

## CollectionRuntime Pattern

### Purpose
Wraps tables/lists with permission checks and consistent structure.

### Usage
```tsx
import { CollectionRuntime, type CollectionModel } from '@/components/runtime';

const MyCollectionModel: CollectionModel = {
  id: 'my-collection',
  name: 'My Collection',
  permissions: ['resource:read'],
};

<CollectionRuntime model={MyCollectionModel} isLoading={isLoading}>
  <DataTable columns={columns} data={data} />
</CollectionRuntime>
```

### Props
- `model: CollectionModel` - Required. Collection schema definition
- `children: React.ReactNode` - Required. Table/list content
- `isLoading?: boolean` - Optional. Loading state

### CollectionModel Schema
```tsx
interface CollectionModel {
  id: string;                    // Unique collection identifier
  name: string;                   // Collection name
  permissions?: string[];         // Required permissions
  requireAll?: boolean;          // AND vs OR logic
  accessDeniedFallback?: React.ReactNode;
}
```

## FormRuntime Pattern

### Purpose
Wraps forms with permission checks for create/update operations.

### Usage
```tsx
import { FormRuntime, type FormModel } from '@/components/runtime';

const CreateUserFormModel: FormModel = {
  id: 'create-user-form',
  name: 'Create User Form',
  permissions: ['users:create'],
};

<FormRuntime model={CreateUserFormModel}>
  <Form>
    <FormField name="email" />
    <FormField name="name" />
    <Button type="submit">Create</Button>
  </Form>
</FormRuntime>
```

### Props
- `model: FormModel` - Required. Form schema definition
- `children: React.ReactNode` - Required. Form content
- `isLoading?: boolean` - Optional. Loading state

### FormModel Schema
```tsx
interface FormModel {
  id: string;                    // Unique form identifier
  name: string;                  // Form name
  permissions?: string[];        // Required permissions (e.g., 'resource:create')
  requireAll?: boolean;
  accessDeniedFallback?: React.ReactNode;
}
```

## DetailRuntime Pattern

### Purpose
Wraps detail views with permission checks.

### Usage
```tsx
import { DetailRuntime, type DetailModel } from '@/components/runtime';

const UserDetailModel: DetailModel = {
  id: 'user-detail',
  name: 'User Detail',
  permissions: ['users:read'],
};

<DetailRuntime model={UserDetailModel} isLoading={isLoading}>
  <UserDetailView user={user} />
</DetailRuntime>
```

### Props
- `model: DetailModel` - Required. Detail schema definition
- `children: React.ReactNode` - Required. Detail view content
- `isLoading?: boolean` - Optional. Loading state

### DetailModel Schema
```tsx
interface DetailModel {
  id: string;                    // Unique detail identifier
  name: string;                  // Detail name
  permissions?: string[];        // Required permissions (typically 'resource:read')
  requireAll?: boolean;
  accessDeniedFallback?: React.ReactNode;
}
```

## Permission Patterns

### Single Permission
```tsx
const model: PageModel = {
  id: 'my-page',
  title: 'My Page',
  permissions: ['users:read'],
};
```

### Multiple Permissions (OR)
```tsx
const model: PageModel = {
  id: 'my-page',
  title: 'My Page',
  permissions: ['users:read', 'users:write'], // User needs ANY permission
};
```

### Multiple Permissions (AND)
```tsx
const model: PageModel = {
  id: 'my-page',
  title: 'My Page',
  permissions: ['users:read', 'users:write'],
  requireAll: true, // User needs ALL permissions
};
```

## Common Patterns

### Page with Collection
```tsx
const PageModel = { id: 'users', title: 'Users', permissions: ['users:read'] };
const CollectionModel = { id: 'users-list', name: 'Users', permissions: ['users:read'] };

<PageRuntime model={PageModel}>
  <CollectionRuntime model={CollectionModel}>
    <UsersTable />
  </CollectionRuntime>
</PageRuntime>
```

### Page with Form
```tsx
const PageModel = { id: 'create-user', title: 'Create User', permissions: ['users:read'] };
const FormModel = { id: 'create-user-form', name: 'Create User', permissions: ['users:create'] };

<PageRuntime model={PageModel}>
  <FormRuntime model={FormModel}>
    <CreateUserForm />
  </FormRuntime>
</PageRuntime>
```

### Page with Detail View
```tsx
const PageModel = { id: 'user-detail', title: 'User Detail', permissions: ['users:read'] };
const DetailModel = { id: 'user-detail-view', name: 'User Detail', permissions: ['users:read'] };

<PageRuntime model={PageModel}>
  <DetailRuntime model={DetailModel}>
    <UserDetailView />
  </DetailRuntime>
</PageRuntime>
```

## Anti-Patterns

### ❌ Don't: Direct component usage without Runtime
```tsx
// WRONG
export default function MyPage() {
  return <MyTable />; // Missing PageRuntime and CollectionRuntime
}
```

### ❌ Don't: Define permissions in components
```tsx
// WRONG
export default function MyPage() {
  const { hasPermission } = usePermissionStore();
  if (!hasPermission('users:read')) return <AccessDenied />;
  return <MyTable />;
}
```

### ✅ Do: Use Runtime wrappers
```tsx
// CORRECT
const PageModel = { id: 'my-page', title: 'My Page', permissions: ['users:read'] };
const CollectionModel = { id: 'my-collection', name: 'My Collection', permissions: ['users:read'] };

export default function MyPage() {
  return (
    <PageRuntime model={PageModel}>
      <CollectionRuntime model={CollectionModel}>
        <MyTable />
      </CollectionRuntime>
    </PageRuntime>
  );
}
```

## Validation

Use the schema validator to validate models:

```tsx
import { validatePageModel } from '@/core/page-model/schema-validator';

const model: PageModel = { /* ... */ };
const result = validatePageModel(model);

if (!result.valid) {
  console.error('Invalid model:', result.errors);
}
```
