# ERP Frontend Runtime Implementation Plan - Speckit v1.0

**Status**: Planning Phase
**Date**: 2026-02-08
**Target**: Transform speckit into Business-Agnostic Enterprise ERP Frontend Runtime

---

## EXECUTIVE SUMMARY

This plan transforms the current speckit dashboard (a well-structured Next.js UI shell) into a comprehensive **Business-Agnostic Enterprise ERP Frontend Runtime** that can:

- Support multiple ERP scenarios without industry-specific code
- Provide stable, SAP-comparable frontend experience
- Enable AI-driven page generation via Schema/DSL
- Support long-term evolution and customization
- Integrate with backend API (NestJS) for auth, permissions, audit logs

**Current State**: UI shell with Clerk auth, Shadcn/ui components, mock data
**Target State**: Complete ERP runtime with API integration, admin modules, permission system, audit logging

---

## PHASE BREAKDOWN

### PHASE 1: Core Infrastructure & API Integration (Weeks 1-2)
- [ ] API Service Layer
- [ ] Global State Management (Zustand stores)
- [ ] Permission/RBAC System
- [ ] Error Handling & Loading States

### PHASE 2: Admin Modules (Weeks 3-4)
- [ ] Users Management
- [ ] Roles Management
- [ ] Departments Management
- [ ] Audit Logs Viewer
- [ ] System Settings

### PHASE 3: Advanced Features (Weeks 5-6)
- [ ] Batch Operations
- [ ] Export Functionality
- [ ] Advanced Filtering
- [ ] State Machine Integration
- [ ] Workflow/Approval System

### PHASE 4: Testing & Optimization (Week 7)
- [ ] Unit Tests
- [ ] E2E Tests
- [ ] Performance Optimization
- [ ] Documentation

---

## PHASE 1: CORE INFRASTRUCTURE & API INTEGRATION

### 1.1 API Service Layer

**Objective**: Create type-safe, error-handling API client

**Backend Info**:
- Base URL: `http://localhost:3001`
- API Docs: `http://localhost:3001/api/docs`
- Auth: JWT Bearer Token
- Token Location: `Authorization: Bearer <token>`

**Files to Create**:
```
src/lib/api/
├── client.ts              # Axios wrapper with interceptors
├── types.ts               # Shared types from backend
├── auth.api.ts            # Auth endpoints
├── menu.api.ts            # Menu endpoints
├── users.api.ts           # Users endpoints
├── roles.api.ts           # Roles endpoints
├── departments.api.ts     # Departments endpoints
├── permissions.api.ts     # Permissions endpoints
├── audit-logs.api.ts      # Audit logs endpoints
├── settings.api.ts        # Settings endpoints
└── error-handler.ts       # Centralized error handling
```

**Key Features**:
- Request/response interceptors
- JWT token management (localStorage)
- Error handling with user feedback
- Loading state management
- Request timeout (30s default)
- Auto-logout on 401

**Backend API Endpoints** (Verified):
```
Auth:
  POST /auth/login          { email, password } → { access_token, user }
  POST /auth/logout         (requires JWT)
  POST /auth/profile        (requires JWT) → user info

Menu:
  GET /menu                 (requires JWT) → MenuItem[]
  POST /menu/filtered       (requires JWT) { permissions } → MenuItem[]
  POST /menu                (requires JWT + Admin)

Users:
  GET /users?page=1&pageSize=10&search=
  POST /users               (requires Admin/Manager)
  GET /users/:id
  PUT /users/:id            (requires Admin/Manager)
  DELETE /users/:id         (requires Admin)

Roles:
  GET /roles
  POST /roles               (requires Admin)
  GET /roles/:id
  PUT /roles/:id            (requires Admin)
  DELETE /roles/:id         (requires Admin)

Departments:
  GET /departments?page=1&pageSize=10
  POST /departments         (requires Admin/Manager)
  GET /departments/:id
  PUT /departments/:id      (requires Admin/Manager)
  DELETE /departments/:id   (requires Admin)

Permissions:
  GET /permissions
  POST /permissions         (requires Admin)
  GET /permissions/:id
  PUT /permissions/:id      (requires Admin)

Audit Logs:
  GET /audit-logs?actor=&action=&resource=&page=1&pageSize=10
  POST /audit-logs/export?format=csv|json
  GET /audit-logs/:id
  POST /audit-logs

Settings:
  GET /settings             (requires JWT)
  POST /settings            (requires JWT)
  PUT /settings             (requires JWT)
```

---

### 1.2 Global State Management (Zustand)

**Objective**: Centralize app-wide state (auth, permissions, UI)

**Files to Create**:
```
src/core/store/
├── auth.store.ts          # User & auth state
├── permission.store.ts    # RBAC & permissions
├── ui.store.ts            # UI state (modals, notifications)
├── notification.store.ts  # Toast/notification queue
└── index.ts               # Export all stores
```

**Auth Store**:
```typescript
interface AuthState {
  user: User | null
  isLoading: boolean
  error: string | null
  setUser: (user: User) => void
  logout: () => void
  fetchUser: () => Promise<void>
}
```

**Permission Store**:
```typescript
interface PermissionState {
  permissions: Permission[]
  roles: Role[]
  userPermissions: string[]
  hasPermission: (permission: string) => boolean
  hasRole: (role: string) => boolean
  canPerformAction: (action: string, resource: string) => boolean
  fetchPermissions: () => Promise<void>
}
```

**UI Store**:
```typescript
interface UIState {
  sidebarOpen: boolean
  theme: 'light' | 'dark'
  notifications: Notification[]
  addNotification: (notification: Notification) => void
  removeNotification: (id: string) => void
}
```

---

### 1.3 Permission/RBAC System

**Objective**: Implement frontend permission checking and UI control

**Files to Create**:
```
src/core/auth/
├── permission-guard.ts    # Permission checking utilities
├── permission-hooks.ts    # usePermission, useCanPerform hooks
├── permission-context.ts  # React Context for permissions
└── types.ts               # Permission types
```

**Key Components**:
- `PermissionGuard` - Wrapper component for permission-based rendering
- `usePermission()` - Hook to check single permission
- `useCanPerform()` - Hook to check action on resource
- `useUserPermissions()` - Hook to get all user permissions
- `withPermission()` - HOC for permission-protected components

**Implementation**:
```typescript
// src/core/auth/permission-guard.ts
export function PermissionGuard({
  permission,
  fallback = null,
  children
}: {
  permission: string
  fallback?: React.ReactNode
  children: React.ReactNode
}) {
  const { hasPermission } = usePermissionStore()
  return hasPermission(permission) ? children : fallback
}

// src/core/auth/permission-hooks.ts
export function usePermission(permission: string) {
  const { hasPermission } = usePermissionStore()
  return hasPermission(permission)
}

export function useCanPerform(action: string, resource: string) {
  const { canPerformAction } = usePermissionStore()
  return canPerformAction(action, resource)
}
```

---

### 1.4 Error Handling & Loading States

**Objective**: Consistent error handling and loading UI

**Files to Create**:
```
src/components/
├── error-boundary.tsx     # React Error Boundary
├── loading-skeleton.tsx   # Skeleton loaders
├── error-fallback.tsx     # Error display component
└── async-boundary.tsx     # Async error handling

src/core/error/
├── error-handler.ts       # Error handling utilities
├── error-context.ts       # Error state context
└── error-hooks.ts         # useError hook
```

**Error Boundary**:
```typescript
// src/components/error-boundary.tsx
- Catch React errors
- Display error UI with retry button
- Log errors to console/audit
- Show user-friendly error messages
```

**Loading States**:
```typescript
// src/components/loading-skeleton.tsx
- Table skeleton
- Form skeleton
- Card skeleton
- List skeleton
```

**API Error Handling**:
```typescript
// src/core/error/error-handler.ts
- Map HTTP status codes to user messages
- Handle network errors
- Handle validation errors
- Handle permission errors (403)
- Handle not found errors (404)
```

---

## PHASE 1 DELIVERABLES

| File | Type | Status |
|------|------|--------|
| `src/lib/api/client.ts` | Create | Pending |
| `src/lib/api/endpoints.ts` | Create | Pending |
| `src/core/store/auth.store.ts` | Create | Pending |
| `src/core/store/permission.store.ts` | Create | Pending |
| `src/core/store/ui.store.ts` | Create | Pending |
| `src/core/auth/permission-guard.ts` | Create | Pending |
| `src/core/auth/permission-hooks.ts` | Create | Pending |
| `src/components/error-boundary.tsx` | Create | Pending |
| `src/components/loading-skeleton.tsx` | Create | Pending |
| `src/core/error/error-handler.ts` | Create | Pending |

---

## PHASE 2: ADMIN MODULES

### 2.1 Users Management Page

**Route**: `/admin/users`

**Features**:
- List all users with pagination
- Search by name/email
- Filter by role/department
- Create new user
- Edit user details
- Delete user
- Batch operations (select multiple, bulk delete)
- Export to CSV

**Files to Create**:
```
src/app/admin/users/
├── page.tsx               # Users list page
├── [userId]/
│   └── page.tsx           # User detail/edit page
└── new/
    └── page.tsx           # Create user page

src/features/users/
├── api.ts                 # User API calls
├── types.ts               # User types
├── components/
│   ├── user-list.tsx      # User table component
│   ├── user-form.tsx      # User form component
│   └── user-detail.tsx    # User detail view
└── hooks/
    └── use-users.ts       # useUsers hook
```

**User Form Schema**:
```typescript
interface UserFormData {
  name: string
  email: string
  phone?: string
  department: string
  roles: string[]
  status: 'active' | 'inactive'
  permissions?: string[]
}
```

---

### 2.2 Roles Management Page

**Route**: `/admin/roles`

**Features**:
- List all roles
- Create new role
- Edit role details
- Assign permissions to role
- Delete role
- View role members

**Files to Create**:
```
src/app/admin/roles/
├── page.tsx               # Roles list page
├── [roleId]/
│   └── page.tsx           # Role detail/edit page
└── new/
    └── page.tsx           # Create role page

src/features/roles/
├── api.ts                 # Role API calls
├── types.ts               # Role types
├── components/
│   ├── role-list.tsx      # Role table component
│   ├── role-form.tsx      # Role form component
│   └── permission-selector.tsx  # Permission picker
└── hooks/
    └── use-roles.ts       # useRoles hook
```

**Role Form Schema**:
```typescript
interface RoleFormData {
  name: string
  description: string
  permissions: string[]
  status: 'active' | 'inactive'
}
```

---

### 2.3 Departments Management Page

**Route**: `/admin/departments`

**Features**:
- List departments (tree view)
- Create department
- Edit department
- Delete department
- Assign users to department
- View department hierarchy

**Files to Create**:
```
src/app/admin/departments/
├── page.tsx               # Departments list page
├── [deptId]/
│   └── page.tsx           # Department detail page
└── new/
    └── page.tsx           # Create department page

src/features/departments/
├── api.ts                 # Department API calls
├── types.ts               # Department types
├── components/
│   ├── department-tree.tsx    # Tree view component
│   ├── department-form.tsx    # Department form
│   └── department-detail.tsx  # Department detail
└── hooks/
    └── use-departments.ts # useDepartments hook
```

---

### 2.4 Audit Logs Page

**Route**: `/admin/audit-logs`

**Features**:
- List all audit logs
- Filter by user/action/resource/date
- Search logs
- View log details
- Export logs

**Files to Create**:
```
src/app/admin/audit-logs/
└── page.tsx               # Audit logs page

src/features/audit-logs/
├── api.ts                 # Audit log API calls
├── types.ts               # Audit log types
├── components/
│   ├── audit-logs-list.tsx    # Logs table
│   ├── audit-log-detail.tsx   # Log detail modal
│   └── audit-filter.tsx       # Filter component
└── hooks/
    └── use-audit-logs.ts  # useAuditLogs hook
```

**Audit Log Schema**:
```typescript
interface AuditLog {
  id: string
  userId: string
  action: string
  resource: string
  resourceId: string
  changes: Record<string, any>
  timestamp: Date
  ipAddress: string
  userAgent: string
}
```

---

### 2.5 System Settings Page

**Route**: `/admin/settings`

**Features**:
- General settings (app name, logo, etc.)
- Email configuration
- Permission settings
- Audit log retention
- Theme customization

**Files to Create**:
```
src/app/admin/settings/
└── page.tsx               # Settings page

src/features/settings/
├── api.ts                 # Settings API calls
├── types.ts               # Settings types
├── components/
│   ├── general-settings.tsx
│   ├── email-settings.tsx
│   ├── permission-settings.tsx
│   └── theme-settings.tsx
└── hooks/
    └── use-settings.ts    # useSettings hook
```

---

## PHASE 2 DELIVERABLES

| Module | Files | Status |
|--------|-------|--------|
| Users | 8 files | Pending |
| Roles | 8 files | Pending |
| Departments | 8 files | Pending |
| Audit Logs | 7 files | Pending |
| Settings | 7 files | Pending |

**Total Phase 2**: ~38 files

---

## PHASE 3: ADVANCED FEATURES

### 3.1 Batch Operations

**Objective**: Support multi-select and bulk actions

**Implementation**:
```typescript
// src/components/batch-operations.tsx
- Checkbox column in tables
- Batch action toolbar
- Select all / deselect all
- Bulk delete, bulk status change, bulk export

// src/hooks/use-batch-selection.ts
- Track selected items
- Provide selection utilities
- Handle bulk actions
```

---

### 3.2 Export Functionality

**Objective**: Export data to CSV/Excel

**Implementation**:
```typescript
// src/lib/export/
├── csv-exporter.ts        # CSV export
├── excel-exporter.ts      # Excel export
└── pdf-exporter.ts        # PDF export

// Usage in components
const { exportToCSV, exportToExcel } = useExport()
exportToCSV(data, 'users.csv')
```

---

### 3.3 Advanced Filtering

**Objective**: Complex filter combinations

**Implementation**:
```typescript
// src/components/advanced-filter.tsx
- Filter builder UI
- Save filter presets
- Apply/clear filters
- Filter history

// src/hooks/use-filter.ts
- Manage filter state
- Apply filters to data
- Persist filter presets
```

---

### 3.4 State Machine Integration

**Objective**: Support workflow states

**Implementation**:
```typescript
// src/core/state-machine/
├── engine.ts              # State machine engine
├── types.ts               # State machine types
└── hooks.ts               # useStateMachine hook

// Example: Order workflow
const orderStateMachine = {
  initial: 'draft',
  states: {
    draft: { on: { SUBMIT: 'pending' } },
    pending: { on: { APPROVE: 'approved', REJECT: 'rejected' } },
    approved: { on: { COMPLETE: 'completed' } },
    rejected: { on: { RESUBMIT: 'pending' } },
    completed: {}
  }
}
```

---

### 3.5 Workflow/Approval System

**Objective**: Support approval workflows

**Implementation**:
```typescript
// src/core/workflow/
├── engine.ts              # Workflow engine
├── types.ts               # Workflow types
└── hooks.ts               # useWorkflow hook

// Features
- Define approval steps
- Route to approvers
- Track approval history
- Send notifications
```

---

## PHASE 3 DELIVERABLES

| Feature | Files | Status |
|---------|-------|--------|
| Batch Operations | 3 files | Pending |
| Export | 4 files | Pending |
| Advanced Filtering | 3 files | Pending |
| State Machine | 4 files | Pending |
| Workflow | 4 files | Pending |

**Total Phase 3**: ~18 files

---

## PHASE 4: TESTING & OPTIMIZATION

### 4.1 Unit Tests

**Coverage**: 80%+ for core modules

```
src/__tests__/
├── core/
│   ├── auth/
│   ├── store/
│   └── error/
├── lib/
│   ├── api/
│   └── export/
└── hooks/
```

### 4.2 E2E Tests

**Critical User Flows**:
- User login
- Create user
- Assign role
- Approve workflow
- Export data

### 4.3 Performance Optimization

- Code splitting
- Image optimization
- Bundle analysis
- Lazy loading

### 4.4 Documentation

- API documentation
- Component storybook
- Architecture guide
- Deployment guide

---

## KEY FILES TO MODIFY

| File | Changes | Priority |
|------|---------|----------|
| `src/app/layout.tsx` | Add providers (auth, permission, notification) | HIGH |
| `src/middleware.ts` | Add permission checks | HIGH |
| `src/components/ui/sidebar.tsx` | Filter by permissions | MEDIUM |
| `package.json` | Add dependencies if needed | MEDIUM |
| `tsconfig.json` | Add path aliases for new modules | LOW |

---

## DEPENDENCIES TO ADD

```json
{
  "axios": "^1.6.0",
  "zustand": "^5.0.2",
  "zod": "^4.1.8",
  "react-hook-form": "^7.54.1",
  "date-fns": "^3.6.0"
}
```

**Already Installed**:
- zustand ✓
- react-hook-form ✓
- zod ✓
- date-fns ✓

---

## ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js App Router                    │
│  /admin/users  /admin/roles  /admin/departments  etc.   │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼──────────┐    ┌────────▼────────┐
│  React Components │    │  Zustand Stores │
│  - Forms         │    │  - Auth         │
│  - Tables        │    │  - Permission   │
│  - Modals        │    │  - UI           │
└────────┬─────────┘    └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │   API Service Layer   │
         │  - HTTP Client        │
         │  - Interceptors       │
         │  - Error Handling     │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │   Backend API (NestJS)│
         │  - Auth               │
         │  - Users              │
         │  - Roles              │
         │  - Permissions        │
         │  - Audit Logs         │
         └───────────────────────┘
```

---

## IMPLEMENTATION SEQUENCE

**Week 1**:
1. Create API service layer
2. Create Zustand stores
3. Create permission system
4. Create error handling

**Week 2**:
1. Integrate with backend API
2. Update layout with providers
3. Create admin layout
4. Test API integration

**Week 3-4**:
1. Build users module
2. Build roles module
3. Build departments module
4. Build audit logs module
5. Build settings module

**Week 5-6**:
1. Add batch operations
2. Add export functionality
3. Add advanced filtering
4. Add state machine
5. Add workflow system

**Week 7**:
1. Write tests
2. Performance optimization
3. Documentation
4. Final review

---

## RISKS & MITIGATION

| Risk | Mitigation |
|------|-----------|
| API integration delays | Start with mock API, swap later |
| Permission system complexity | Use simple RBAC first, extend later |
| Performance issues | Implement pagination, lazy loading early |
| Type safety gaps | Use strict TypeScript, Zod validation |
| Testing coverage | Use TDD for critical paths |

---

## SUCCESS CRITERIA

- [ ] All admin modules functional
- [ ] API integration complete
- [ ] Permission system working
- [ ] 80%+ test coverage
- [ ] Performance metrics met
- [ ] Documentation complete
- [ ] Zero critical bugs
- [ ] Can handle 1000+ users

---

## NEXT STEPS

1. **Review this plan** - Validate approach and timeline
2. **Approve Phase 1** - Start with infrastructure
3. **Execute Phase 1** - Build API layer and stores
4. **Iterate** - Move to Phase 2 after Phase 1 complete

---

**Plan Version**: 1.0
**Last Updated**: 2026-02-08
**Status**: Ready for Review
