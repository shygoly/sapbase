# Phase 3: Frontend Unit Tests - Execution Guide

## Overview

Phase 3 focuses on frontend unit tests for authentication, API integration, permissions, and state management.

## Test Files Summary

### 1. Auth Service Tests (12 cases)
**File**: `speckit/src/lib/__tests__/auth-service.test.ts`

**Test Groups**:
- Login: 4 cases
- Logout: 3 cases
- Profile: 3 cases
- Token Management: 2 cases

### 2. API Service Tests (8 cases)
**File**: `speckit/src/lib/__tests__/api-service.test.ts`

**Test Groups**:
- Request Headers: 2 cases
- CRUD Operations: 4 cases
- Error Handling: 2 cases

### 3. Permission Guard Tests (15 cases)
**File**: `speckit/src/core/auth/__tests__/permission-guard.test.ts`

**Test Groups**:
- Permission Checking: 6 cases
- Resource Access: 5 cases
- Error Throwing: 4 cases

### 4. Auth Context Tests (7 cases)
**File**: `speckit/src/core/auth/__tests__/context.test.tsx`

**Test Groups**:
- Provider Initialization: 2 cases
- Login/Logout: 3 cases
- Error Handling: 2 cases

## Running Tests

### Quick Start
```bash
cd speckit
npm run test
```

### With Coverage
```bash
npm run test:cov
```

### Specific Test File
```bash
npm run test -- auth-service.test.ts
```

### Watch Mode
```bash
npm run test -- --watch
```

## Expected Results

✅ All 42+ test cases should pass
✅ Coverage should be 80%+
✅ No console errors or warnings
✅ All mocks properly configured

## Troubleshooting

**Issue**: Tests fail with "Cannot find module"
- Solution: Run `npm install` in speckit directory

**Issue**: localStorage is not defined
- Solution: Jest setup mocks localStorage automatically

**Issue**: fetch is not defined
- Solution: Jest setup mocks fetch automatically

## Next Phase

After Phase 3 passes:
- Proceed to Phase 4 (Frontend Integration Tests)
- Test complete page functionality
- Verify UI rendering with permissions

---

**Phase**: 3 of 6
**Status**: Ready for Execution
**Estimated Time**: ~45 seconds
