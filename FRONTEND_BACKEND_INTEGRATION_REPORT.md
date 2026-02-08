# Frontend-Backend Integration Analysis Report

**Date**: 2026-02-07
**Project**: Speckit ERP
**Frontend**: Next.js 14 with React 18 (TypeScript)
**Backend**: NestJS 10 with PostgreSQL

---

## Executive Summary

The Speckit ERP project has a **frontend-backend integration gap** with **17 identified issues** across data models, API signatures, authentication, and error handling. While the basic architecture is sound, there are **3 CRITICAL issues** that must be addressed immediately:

1. **Password hashing not implemented** (security vulnerability)
2. **Department field name mismatch** (data corruption risk)
3. **Missing backend endpoints** (404 errors in production)

---

## Architecture Overview

### Backend (NestJS)
- **Framework**: NestJS 10.3.0 with Express
- **Database**: PostgreSQL with TypeORM
- **Auth**: JWT with Passport.js
- **API Base**: `http://localhost:3001/api`
- **Entities**: Users, Departments, Roles

### Frontend (Next.js)
- **Framework**: Next.js 14 with React 18
- **API Client**: Custom service layer
- **Auth**: JWT token storage in localStorage
- **API Base**: `http://localhost:3001/api`
- **Features**: Users, Departments, Roles, Audit Logs, Settings

---

## Critical Issues (Must Fix)

### 🔴 Issue #6: Password Hashing Not Implemented

**Severity**: CRITICAL (Security)
**Location**: Backend `/src/auth/auth.service.ts:21`

```typescript
// Current (INSECURE)
validateUser(email: string, password: string) {
  // TODO: Implement password hashing and comparison
  return this.usersService.findByEmail(email);
}
```

**Impact**:
- Passwords stored in plain text
- Passwords transmitted without hashing
- Violates OWASP security standards

**Fix Required**:
```typescript
import * as bcrypt from 'bcrypt';

async validateUser(email: string, password: string) {
  const user = await this.usersService.findByEmail(email);
  if (!user) return null;

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  return isPasswordValid ? user : null;
}
```

---

### 🔴 Issue #2: Department Field Name Mismatch

**Severity**: CRITICAL (Data Corruption)
**Locations**:
- Frontend: `/speckit/src/features/departments/api.ts:9` (uses `parentId`)
- Backend: `/backend/src/departments/department.entity.ts:24` (uses `managerId`)

**Current Mismatch**:
```typescript
// Frontend sends
{ name: "Sales", parentId: "user-123" }

// Backend expects
{ name: "Sales", managerId: "user-123" }
```

**Impact**:
- Frontend sends `parentId` which backend ignores
- Department manager assignment fails silently
- Data inconsistency between systems

**Fix Required**: Align field names across both systems (recommend `managerId`)

---

### 🔴 Issue #14: Missing Backend Endpoints

**Severity**: CRITICAL (404 Errors)
**Location**: Frontend `/speckit/src/config/api.ts:41-59`

Frontend defines but backend doesn't implement:
- `/api/audit-logs/*` (lines 41-46)
- `/api/settings/*` (lines 48-53)
- `/api/permissions/*` (lines 55-59)

**Impact**:
- All audit log operations return 404
- Settings endpoints fail
- Permissions endpoints fail

**Fix Required**: Either implement these endpoints in backend or remove from frontend

---

## High Priority Issues

### 🟠 Issue #1: User Status Enum Mismatch

**Severity**: HIGH
**Locations**:
- Frontend: `/speckit/src/features/users/api.ts:11` → `'active' | 'inactive'`
- Backend: `/backend/src/users/user.entity.ts:27` → `'active' | 'inactive' | 'suspended'`

**Impact**: Frontend cannot display or manage suspended users

**Fix**: Update frontend User interface:
```typescript
export interface User {
  id: string
  name: string
  email: string
  role: string
  department?: string
  status: 'active' | 'inactive' | 'suspended'  // Add 'suspended'
  createdAt: Date
  updatedAt: Date
}
```

---

### 🟠 Issue #5: Permissions Not in Login Response

**Severity**: HIGH
**Locations**:
- Frontend: `/speckit/src/lib/auth-service.ts:6-14`
- Backend: `/backend/src/auth/auth.service.ts:10`

Backend JWT includes permissions but login response doesn't:
```typescript
// Backend JWT payload
{ sub: string, email: string, role: string, permissions: string[] }

// Frontend LoginResponse
{ access_token: string, user: { id, name, email, role } }
```

**Impact**: Frontend cannot access user permissions from login

**Fix**: Update backend login response to include permissions:
```typescript
async login(user: User) {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions || []
  };
  return {
    access_token: this.jwtService.sign(payload),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions || []
    }
  };
}
```

---

### 🟠 Issue #10: Frontend Missing Role-Based Access Control

**Severity**: HIGH
**Locations**:
- Frontend: `/speckit/src/lib/auth-service.ts` (no RBAC)
- Backend: `/backend/src/roles/roles.controller.ts:22` (enforces RBAC)

Backend enforces role restrictions but frontend doesn't check:
```typescript
// Backend
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Post()
create(@Body() createRoleDto: CreateRoleDto) { ... }

// Frontend - no permission check before calling
async createRole(role: CreateRoleInput) {
  return this.apiService.post('/roles', role);  // No auth check!
}
```

**Impact**: Frontend attempts unauthorized operations, backend rejects with 403

**Fix**: Add permission checks in frontend before API calls:
```typescript
async createRole(role: CreateRoleInput) {
  if (!this.hasPermission('roles:create')) {
    throw new Error('Insufficient permissions');
  }
  return this.apiService.post('/roles', role);
}
```

---

## Medium Priority Issues

### 🟡 Issue #3: Department Status Field Missing

**Severity**: MEDIUM
**Locations**:
- Frontend: `/speckit/src/features/departments/api.ts` (no status)
- Backend: `/backend/src/departments/department.entity.ts:30` (has status)

**Fix**: Add status to frontend Department interface:
```typescript
export interface Department {
  id: string
  name: string
  description?: string
  managerId?: string
  status: 'active' | 'inactive'  // Add this
  createdAt: Date
  updatedAt: Date
}
```

---

### 🟡 Issue #4: Role Status Field Missing

**Severity**: MEDIUM
**Locations**:
- Frontend: `/speckit/src/features/roles/api.ts` (no status)
- Backend: `/backend/src/roles/role.entity.ts:24` (has status)

**Fix**: Add status to frontend Role interface:
```typescript
export interface Role {
  id: string
  name: string
  permissions: string[]
  description?: string
  status: 'active' | 'inactive'  // Add this
  createdAt: Date
  updatedAt: Date
}
```

---

### 🟡 Issue #7: User Role Required vs Optional

**Severity**: MEDIUM
**Locations**:
- Frontend: `/speckit/src/features/users/api.ts:19` (role required)
- Backend: `/backend/src/users/dto/create-user.dto.ts:12` (role optional)

Frontend validation is stricter than backend. Align by making role optional in frontend:
```typescript
export interface CreateUserInput {
  name: string
  email: string
  role?: string  // Make optional
  department?: string
}
```

---

### 🟡 Issue #9: Role Permissions Required vs Optional

**Severity**: MEDIUM
**Locations**:
- Frontend: `/speckit/src/features/roles/api.ts:16` (permissions required)
- Backend: `/backend/src/roles/dto/create-role.dto.ts:12` (permissions optional)

Make permissions optional in frontend:
```typescript
export interface CreateRoleInput {
  name: string
  permissions?: string[]  // Make optional
  description?: string
}
```

---

### 🟡 Issue #12: Unstructured Error Responses

**Severity**: MEDIUM
**Locations**:
- Frontend: `/speckit/src/lib/api-service.ts:50`
- Backend: All controllers

Backend throws generic errors without consistent format. Implement error interceptor:

**Backend Fix**:
```typescript
// Create error.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      message: exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

### 🟡 Issue #13: Error Response Body Not Parsed

**Severity**: MEDIUM
**Location**: Frontend `/speckit/src/lib/api-service.ts:50`

Current error handling doesn't parse response body:
```typescript
// Current
catch (error) {
  throw new Error('API request failed');  // Generic message
}

// Should be
catch (error) {
  if (error.response?.data?.message) {
    throw new Error(error.response.data.message);
  }
  throw error;
}
```

---

### 🟡 Issue #15: Type Safety Lost in API Service

**Severity**: MEDIUM
**Location**: Frontend `/speckit/src/lib/api-service.ts:62-88`

All methods use `any` type:
```typescript
// Current
async get<T = any>(url: string): Promise<T> { ... }
async post<T = any>(url: string, data: any): Promise<T> { ... }

// Better
async get<T>(url: string): Promise<T> { ... }
async post<T, D = any>(url: string, data: D): Promise<T> { ... }
```

---

## Low Priority Issues

### 🟢 Issue #11: Frontend Missing Authentication Verification

**Severity**: LOW
**Location**: Frontend feature APIs

Frontend should verify token exists before making requests:
```typescript
private ensureAuthenticated() {
  const token = localStorage.getItem('access_token');
  if (!token) {
    throw new Error('Not authenticated');
  }
}
```

---

### 🟢 Issue #16: Update DTOs Don't Explicitly Define Status

**Severity**: LOW
**Locations**:
- Frontend: `/speckit/src/features/users/api.ts:28`
- Backend: `/backend/src/users/dto/update-user.dto.ts`

Backend UpdateUserDto extends CreateUserDto. Clarify if status can be updated:
```typescript
// Backend - make explicit
export class UpdateUserDto extends PartialType(CreateUserDto) {
  // Inherits all fields as optional, including status
}
```

---

### 🟢 Issue #17: Backend TODOs Not Completed

**Severity**: LOW (but blocks functionality)
**Location**: Backend `/src/auth/auth.service.ts:21,35`

Two incomplete implementations:
1. Line 21: Password hashing (covered in Issue #6)
2. Line 35: Load permissions from database

**Fix for permissions**:
```typescript
async validateToken(token: string) {
  try {
    const payload = this.jwtService.verify(token);
    // Load fresh permissions from database
    const user = await this.usersService.findOne(payload.sub);
    return { ...payload, permissions: user.permissions || [] };
  } catch (error) {
    return null;
  }
}
```

---

## Integration Checklist

### Phase 1: Critical Fixes (Week 1)
- [ ] Implement password hashing in backend auth
- [ ] Fix department field name (parentId → managerId)
- [ ] Implement missing backend endpoints or remove from frontend
- [ ] Add 'suspended' status to User interface
- [ ] Add status fields to Department and Role interfaces

### Phase 2: High Priority (Week 1-2)
- [ ] Add permissions to login response
- [ ] Implement RBAC checks in frontend
- [ ] Implement structured error responses
- [ ] Add authentication verification before API calls

### Phase 3: Medium Priority (Week 2)
- [ ] Align optional/required fields between frontend and backend
- [ ] Improve error response parsing
- [ ] Add proper typing to API service
- [ ] Complete backend TODOs

### Phase 4: Low Priority (Week 3)
- [ ] Enhance error handling
- [ ] Add comprehensive logging
- [ ] Implement request/response interceptors
- [ ] Add request validation middleware

---

## Testing Recommendations

### Unit Tests
- [ ] Auth service password validation
- [ ] Permission checking logic
- [ ] Error response parsing
- [ ] Data transformation functions

### Integration Tests
- [ ] Login flow with permissions
- [ ] Department creation with manager assignment
- [ ] Role-based access control
- [ ] Error handling for all endpoints

### E2E Tests
- [ ] Complete user management workflow
- [ ] Department hierarchy management
- [ ] Role and permission assignment
- [ ] Audit logging

---

## Deployment Considerations

1. **Database Migration**: Add password hashing to existing users
2. **API Versioning**: Consider versioning endpoints for backward compatibility
3. **Feature Flags**: Use feature flags for gradual rollout of RBAC
4. **Monitoring**: Add error tracking and performance monitoring
5. **Documentation**: Update API documentation with all changes

---

## Conclusion

The Speckit ERP frontend-backend integration requires focused effort on **3 critical issues** and **7 high-priority issues** to achieve production readiness. The recommended timeline is **2-3 weeks** for all fixes, with critical issues taking priority in the first week.

**Next Steps**:
1. Create GitHub issues for each critical item
2. Assign to development team
3. Implement fixes in priority order
4. Add comprehensive tests
5. Deploy with monitoring

