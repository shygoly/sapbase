# Speckit Architecture Rules

## Overview

Speckit is a **Business-Agnostic ERP Frontend Runtime**. This document outlines the architectural principles and rules that must be followed when developing features.

## Core Principles

### 1. Runtime-First Architecture

All pages, forms, and collections must use the corresponding Runtime component:

- **Pages**: Use `PageRuntime` with a `PageModel`
- **Forms**: Use `FormRuntime` with a `FormSchema`
- **Collections**: Use `CollectionRuntime` with a `CollectionSchema`

This ensures consistent behavior, permission checking, and state management across the application.

### 2. Schema-First Development

Define schemas before implementing UI:

1. Define the schema (PageModel, FormSchema, CollectionSchema)
2. Create the Runtime component with the schema
3. Implement the UI inside the Runtime component

### 3. Business-Agnostic Design

- ❌ **DO NOT** add business logic to UI components
- ❌ **DO NOT** hardcode business rules
- ✅ **DO** define business logic in schemas
- ✅ **DO** use Runtime components to enforce rules

## Prohibited Patterns

### ❌ Direct UI Component Usage

**WRONG:**
```tsx
export default function UsersPage() {
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    </div>
  );
}
```

**CORRECT:**
```tsx
const collectionSchema: CollectionSchema = {
  id: 'users-table',
  title: 'Users',
  columns: [
    { id: 'email', label: 'Email', type: 'text' }
  ]
};

export default function UsersPage() {
  return (
    <CollectionRuntime schema={collectionSchema}>
      <DataTable />
    </CollectionRuntime>
  );
}
```

### ❌ Skipping Runtime Layer

**WRONG:**
```tsx
export default function UserForm() {
  const [email, setEmail] = useState('');

  return (
    <form>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
    </form>
  );
}
```

**CORRECT:**
```tsx
const formSchema: FormSchema = {
  id: 'user-form',
  title: 'User Form',
  fields: [
    { name: 'email', type: 'email', label: 'Email', required: true }
  ]
};

export default function UserForm() {
  return (
    <FormRuntime schema={formSchema}>
      <FormFields />
    </FormRuntime>
  );
}
```

### ❌ Business Logic in Components

**WRONG:**
```tsx
export function UsersList() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    // Business logic mixed with UI
    if (userRole === 'admin') {
      fetchAllUsers();
    } else {
      fetchUserTeamMembers();
    }
  }, [userRole]);

  return <Table data={users} />;
}
```

**CORRECT:**
```tsx
// Define in schema
const collectionSchema: CollectionSchema = {
  id: 'users-table',
  title: 'Users',
  columns: [...],
  permissions: ['users:read']
};

// Use in component
export function UsersList() {
  return (
    <CollectionRuntime schema={collectionSchema}>
      <DataTable />
    </CollectionRuntime>
  );
}
```

## Required Patterns

### ✅ PageRuntime for All Pages

```tsx
import { PageRuntime } from '@/components/runtime/page-runtime';
import { PageModel } from '@/core/page-model/types';

const pageModel: PageModel = {
  id: 'users-page',
  title: 'Users',
  permissions: ['users:read'],
  // ... other model properties
};

export default function UsersPage() {
  return (
    <PageRuntime model={pageModel}>
      <UsersList />
    </PageRuntime>
  );
}
```

### ✅ FormRuntime for All Forms

```tsx
import { FormRuntime } from '@/components/runtime/form-runtime';

const formSchema: FormSchema = {
  id: 'user-form',
  title: 'User Form',
  fields: [
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      required: true,
      validation: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }
    }
  ]
};

export default function UserForm() {
  return (
    <FormRuntime schema={formSchema}>
      <FormFields />
    </FormRuntime>
  );
}
```

### ✅ CollectionRuntime for All Lists/Tables

```tsx
import { CollectionRuntime } from '@/components/runtime/collection-runtime';

const collectionSchema: CollectionSchema = {
  id: 'users-table',
  title: 'Users',
  columns: [
    { id: 'email', label: 'Email', type: 'text', sortable: true },
    { id: 'role', label: 'Role', type: 'select', sortable: true }
  ],
  actions: [
    { id: 'edit', label: 'Edit', type: 'primary' },
    { id: 'delete', label: 'Delete', type: 'danger' }
  ]
};

export default function UsersTable() {
  return (
    <CollectionRuntime schema={collectionSchema}>
      <DataTable />
    </CollectionRuntime>
  );
}
```

## RBAC Navigation

Navigation items are automatically filtered based on user permissions using the `access` property:

```tsx
// In nav-config.ts
const navItems: NavItem[] = [
  {
    id: 'users',
    label: 'Users',
    path: '/admin/users',
    icon: 'users',
    access: {
      requireOrg: true,
      permission: 'users:manage',
      role: 'admin'
    }
  }
];
```

The `access` property supports:
- `requireOrg`: Require organization context
- `permission`: Require specific permission
- `role`: Require specific role
- `roles`: Require any of multiple roles
- `plan`: Require specific plan level
- `feature`: Require specific feature flag

## Component Organization

```
speckit/src/
├── components/
│   ├── ui/                    # shadcn/ui components (no business logic)
│   ├── layout/                # Layout components (sidebar, header, etc.)
│   ├── runtime/               # Runtime wrapper components
│   │   ├── page-runtime.tsx
│   │   ├── form-runtime.tsx
│   │   └── collection-runtime.tsx
│   └── [feature]/             # Feature-specific components
├── core/
│   ├── auth/                  # Authentication & authorization
│   ├── page-model/            # Page model definitions
│   ├── state-machine/         # State machine logic
│   ├── navigation/            # Navigation system
│   └── [other-core]/
├── config/
│   ├── nav-config.ts          # Navigation configuration
│   └── [other-config]/
└── types/
    ├── index.ts               # Central type exports
    ├── nav.ts                 # Navigation types
    └── [other-types]/
```

## Checklist for New Features

- [ ] Define PageModel for the page
- [ ] Define FormSchema for any forms
- [ ] Define CollectionSchema for any lists/tables
- [ ] Wrap page with PageRuntime
- [ ] Wrap forms with FormRuntime
- [ ] Wrap collections with CollectionRuntime
- [ ] Add RBAC access control to nav-config.ts if needed
- [ ] No business logic in UI components
- [ ] No hardcoded business rules
- [ ] All permissions checked via Runtime components

## Common Mistakes

### Mistake 1: Mixing Business Logic with UI

```tsx
// ❌ WRONG
export function UsersList() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (userRole === 'admin') {
      // Business logic in component
      fetchAllUsers();
    }
  }, [userRole]);

  return <Table data={users} />;
}
```

**Fix**: Move business logic to schema and use Runtime component.

### Mistake 2: Skipping Runtime Components

```tsx
// ❌ WRONG
export default function UsersPage() {
  return <UsersList />;
}
```

**Fix**: Wrap with PageRuntime.

### Mistake 3: Hardcoding Permissions

```tsx
// ❌ WRONG
if (user.role === 'admin') {
  return <AdminPanel />;
}
```

**Fix**: Use RBAC access control in nav-config.ts and Runtime components.

## Questions?

Refer to:
- `speckit/src/core/page-model/types.ts` - PageModel definition
- `speckit/src/core/auth/permission-guard.ts` - Permission checking
- `speckit/src/config/nav-config.ts` - Navigation configuration examples
