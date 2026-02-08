# Test Environment Deployment Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Git
- npm or yarn

## Phase 1: Database Setup

### 1.1 Create Test Database

```bash
# Connect to PostgreSQL
psql -U postgres -h localhost

# Create test database
CREATE DATABASE sapbasic_test;
CREATE USER test_user WITH PASSWORD 'test_password';
ALTER ROLE test_user SET client_encoding TO 'utf8';
ALTER ROLE test_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE test_user SET default_transaction_deferrable TO on;
ALTER ROLE test_user SET default_transaction_read_only TO off;
GRANT ALL PRIVILEGES ON DATABASE sapbasic_test TO test_user;

# Exit psql
\q
```

### 1.2 Configure Backend Environment

```bash
cd backend

# Copy environment template
cp .env.example .env.test

# Edit .env.test with test database credentials
cat > .env.test << 'EOF'
NODE_ENV=test
PORT=3001
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=test_user
DATABASE_PASSWORD=test_password
DATABASE_NAME=sapbasic_test
JWT_SECRET=test-secret-key-for-testing-only
JWT_EXPIRATION=3600
EOF
```

### 1.3 Run Database Migrations

```bash
# Install dependencies
npm install

# Run migrations
npm run typeorm migration:run -- -d src/database.config.ts

# Verify tables created
psql -U test_user -h localhost -d sapbasic_test -c "\dt"
```

## Phase 2: Seed Test Data

### 2.1 Create Test Data Seeder

```bash
# Create seed script
cat > backend/src/seeds/test-data.seed.ts << 'EOF'
import { DataSource } from 'typeorm'
import { User } from '../users/user.entity'
import { Role } from '../roles/role.entity'
import { Department } from '../departments/department.entity'

export async function seedTestData(dataSource: DataSource) {
  const userRepository = dataSource.getRepository(User)
  const roleRepository = dataSource.getRepository(Role)
  const departmentRepository = dataSource.getRepository(Department)

  // Create roles
  const superAdminRole = roleRepository.create({
    name: 'super_admin',
    permissions: ['*'],
  })
  const adminRole = roleRepository.create({
    name: 'admin',
    permissions: ['users.view', 'users.create', 'users.edit', 'users.delete',
                  'departments.view', 'departments.create', 'departments.edit', 'departments.delete',
                  'roles.view', 'roles.create', 'roles.edit', 'roles.delete'],
  })
  const userRole = roleRepository.create({
    name: 'user',
    permissions: ['users.view', 'departments.view', 'roles.view'],
  })

  await roleRepository.save([superAdminRole, adminRole, userRole])

  // Create departments
  const engDept = departmentRepository.create({
    name: 'Engineering',
    description: 'Engineering Department',
  })
  const hrDept = departmentRepository.create({
    name: 'Human Resources',
    description: 'HR Department',
  })

  await departmentRepository.save([engDept, hrDept])

  // Create test users
  const superAdmin = userRepository.create({
    email: 'super@test.com',
    password: 'password123',
    name: 'Super Admin',
    role: superAdminRole,
    dataScope: 'all',
  })
  const admin = userRepository.create({
    email: 'admin@test.com',
    password: 'password123',
    name: 'Admin User',
    role: adminRole,
    dataScope: 'organization',
    department: engDept,
  })
  const manager = userRepository.create({
    email: 'manager@test.com',
    password: 'password123',
    name: 'Department Manager',
    role: userRole,
    dataScope: 'department',
    department: engDept,
  })
  const regularUser = userRepository.create({
    email: 'user@test.com',
    password: 'password123',
    name: 'Regular User',
    role: userRole,
    dataScope: 'self',
    department: engDept,
  })

  await userRepository.save([superAdmin, admin, manager, regularUser])

  console.log('Test data seeded successfully')
}
EOF
```

### 2.2 Run Seeder

```bash
npm run seed:test
```

## Phase 3: Backend Deployment

### 3.1 Install Dependencies

```bash
cd backend
npm install
```

### 3.2 Build Backend

```bash
npm run build
```

### 3.3 Start Backend in Test Mode

```bash
# Terminal 1: Start backend
npm run start:test

# Expected output:
# [Nest] 12345  - 02/07/2026, 10:00:00 AM     LOG [NestFactory] Starting Nest application...
# [Nest] 12345  - 02/07/2026, 10:00:01 AM     LOG [InstanceLoader] TypeOrmModule dependencies initialized
# [Nest] 12345  - 02/07/2026, 10:00:02 AM     LOG [RoutesResolver] AppController {/api}:
# [Nest] 12345  - 02/07/2026, 10:00:02 AM     LOG [NestApplication] Nest application successfully started on port 3001
```

### 3.4 Verify Backend Health

```bash
# Terminal 2: Test backend
curl http://localhost:3001/api/health

# Expected response:
# {"status":"ok"}
```

## Phase 4: Frontend Deployment

### 4.1 Install Dependencies

```bash
cd speckit
npm install --legacy-peer-deps
```

### 4.2 Configure Frontend Environment

```bash
# Copy environment template
cp .env.example .env.test

# Edit .env.test
cat > .env.test << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_APP_NAME=Speckit Test
NEXT_PUBLIC_APP_ENV=test
EOF
```

### 4.3 Build Frontend

```bash
npm run build
```

### 4.4 Start Frontend in Test Mode

```bash
# Terminal 3: Start frontend
npm run dev

# Expected output:
# ▲ Next.js 15.0.0
# - Local:        http://localhost:3000
# - Environments: .env.test
```

### 4.5 Verify Frontend Access

```bash
# Open browser
open http://localhost:3000

# Expected: Login page should load
```

## Phase 5: Run Tests

### 5.1 Backend Unit Tests

```bash
cd backend

# Run all unit tests
npm run test

# Run with coverage
npm run test:cov

# Expected output:
# PASS  src/auth/auth.service.spec.ts
# PASS  src/auth/jwt.strategy.spec.ts
# PASS  src/auth/guards/permissions.guard.spec.ts
# PASS  src/auth/guards/roles.guard.spec.ts
# Test Suites: 4 passed, 4 total
# Tests:       50 passed, 50 total
# Coverage: 85%+
```

### 5.2 Backend Integration Tests

```bash
cd backend

# Run e2e tests
npm run test:e2e

# Expected output:
# PASS  test/auth.e2e-spec.ts
# PASS  test/users.e2e-spec.ts
# PASS  test/departments.e2e-spec.ts
# PASS  test/roles.e2e-spec.ts
# Test Suites: 4 passed, 4 total
# Tests:       40 passed, 40 total
```

### 5.3 Frontend Unit Tests

```bash
cd speckit

# Run unit tests
npm run test

# Run with coverage
npm run test:cov

# Expected output:
# PASS  src/lib/__tests__/auth-service.test.ts
# PASS  src/lib/__tests__/api-service.test.ts
# PASS  src/core/auth/__tests__/permission-guard.test.ts
# PASS  src/core/auth/__tests__/context.test.tsx
# Test Suites: 4 passed, 4 total
# Tests:       60 passed, 60 total
# Coverage: 80%+
```

### 5.4 Frontend E2E Tests

```bash
cd speckit

# Install Playwright (if not already installed)
npm install -D @playwright/test

# Run e2e tests
npm run test:e2e

# Run with UI mode
npm run test:e2e -- --ui

# Expected output:
# Running 15 tests using 1 worker
# ✓ Authentication Flow > should login with valid credentials
# ✓ Authentication Flow > should show error with invalid credentials
# ✓ Permission Enforcement > super_admin should see all admin pages
# ✓ Data Scope Enforcement > organization scope should only show org users
# ✓ Complete Admin Workflow > should create department, role, and user
# 15 passed (45s)
```

## Phase 6: Smoke Tests

### 6.1 Authentication Flow Smoke Test

```bash
# Test login endpoint
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "password123"
  }'

# Expected response:
# {
#   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "user": {
#     "id": "...",
#     "email": "admin@test.com",
#     "name": "Admin User",
#     "role": "admin"
#   }
# }
```

### 6.2 Protected Endpoint Smoke Test

```bash
# Get token from login
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123"}' | jq -r '.access_token')

# Test protected endpoint
curl -X GET http://localhost:3001/api/users \
  -H "Authorization: Bearer $TOKEN"

# Expected response:
# [
#   {
#     "id": "...",
#     "email": "admin@test.com",
#     "name": "Admin User",
#     ...
#   },
#   ...
# ]
```

### 6.3 Permission Enforcement Smoke Test

```bash
# Test with user lacking permission
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"password123"}' | jq -r '.access_token')

# Try to create role (should fail)
curl -X POST http://localhost:3001/api/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","permissions":[]}'

# Expected response:
# {
#   "statusCode": 403,
#   "message": "Forbidden",
#   "error": "Insufficient permissions"
# }
```

## Phase 7: Deployment Checklist

- [ ] PostgreSQL database created and configured
- [ ] Test database user created with correct permissions
- [ ] Backend environment variables configured (.env.test)
- [ ] Database migrations run successfully
- [ ] Test data seeded successfully
- [ ] Backend builds without errors
- [ ] Backend starts on port 3001
- [ ] Backend health check passes
- [ ] Frontend environment variables configured (.env.test)
- [ ] Frontend builds without errors
- [ ] Frontend starts on port 3000
- [ ] Login page loads successfully
- [ ] Backend unit tests pass (80%+ coverage)
- [ ] Backend integration tests pass
- [ ] Frontend unit tests pass (80%+ coverage)
- [ ] Frontend E2E tests pass
- [ ] Authentication flow smoke test passes
- [ ] Protected endpoint smoke test passes
- [ ] Permission enforcement smoke test passes
- [ ] All test users can login successfully
- [ ] Permission-based UI hiding works correctly
- [ ] Data scope filtering works correctly

## Troubleshooting

### Database Connection Error

```bash
# Verify PostgreSQL is running
psql -U postgres -h localhost -c "SELECT 1"

# Check database exists
psql -U postgres -h localhost -c "\l" | grep sapbasic_test

# Check user permissions
psql -U postgres -h localhost -c "\du" | grep test_user
```

### Backend Won't Start

```bash
# Check port 3001 is available
lsof -i :3001

# Check environment variables
cat backend/.env.test

# Check database connection
npm run typeorm query "SELECT 1"
```

### Frontend Won't Start

```bash
# Check port 3000 is available
lsof -i :3000

# Clear Next.js cache
rm -rf speckit/.next

# Reinstall dependencies
rm -rf speckit/node_modules
npm install --legacy-peer-deps
```

### Tests Failing

```bash
# Check test database is clean
psql -U test_user -h localhost -d sapbasic_test -c "SELECT COUNT(*) FROM users"

# Reseed test data
npm run seed:test

# Run tests with verbose output
npm run test -- --verbose
```

## Next Steps

After successful deployment:
1. Run full test suite daily
2. Monitor test coverage trends
3. Add new tests for bug fixes
4. Update tests when features change
5. Document any test failures
6. Plan performance testing phase
