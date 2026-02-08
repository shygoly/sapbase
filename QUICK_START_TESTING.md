# Quick Start: Running Tests

## Prerequisites

```bash
# Install Node.js 18+
node --version  # Should be v18.0.0 or higher

# Install PostgreSQL 14+
psql --version  # Should be psql (PostgreSQL) 14.0 or higher
```

## Backend Tests - Quick Start

### 1. Setup Test Database

```bash
# Create test database
psql -U postgres -h localhost << 'EOF'
CREATE DATABASE sapbasic_test;
CREATE USER test_user WITH PASSWORD 'test_password';
GRANT ALL PRIVILEGES ON DATABASE sapbasic_test TO test_user;
EOF
```

### 2. Configure Backend

```bash
cd backend

# Copy environment
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
JWT_SECRET=test-secret-key
JWT_EXPIRATION=3600
EOF
```

### 3. Install & Run Tests

```bash
# Install dependencies
npm install

# Run unit tests
npm run test

# Run integration tests
npm run test:e2e

# Run with coverage
npm run test:cov
```

## Frontend Tests - Quick Start

### 1. Configure Frontend

```bash
cd speckit

# Copy environment
cp .env.example .env.test

# Edit .env.test
cat > .env.test << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_APP_ENV=test
EOF
```

### 2. Install & Run Tests

```bash
# Install dependencies
npm install --legacy-peer-deps

# Run unit tests
npm run test

# Run with coverage
npm run test:cov

# Run E2E tests (requires backend running)
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

## Complete Test Flow

### Terminal 1: Start Backend

```bash
cd backend
npm run start:test:dev
# Wait for: "Nest application successfully started on port 3001"
```

### Terminal 2: Run Backend Tests

```bash
cd backend
npm run test:e2e
# Should see: "Test Suites: X passed, X total"
```

### Terminal 3: Start Frontend

```bash
cd speckit
npm run dev
# Wait for: "Ready in X.XXs"
```

### Terminal 4: Run Frontend Tests

```bash
cd speckit
npm run test:e2e
# Should see: "X passed"
```

## Test Results Interpretation

### Passing Tests
```
✓ should login with valid credentials
✓ should show error with invalid credentials
✓ should logout successfully

Test Suites: 4 passed, 4 total
Tests:       50 passed, 50 total
Coverage:    85%+
```

### Failing Tests
```
✗ should login with valid credentials
  Error: Timeout waiting for element

Test Suites: 1 failed, 4 total
Tests:       1 failed, 50 total
```

**Action**: Check error message and test logs for details.

## Common Issues & Solutions

### Issue: "Cannot connect to database"
```bash
# Check PostgreSQL is running
psql -U postgres -h localhost -c "SELECT 1"

# Verify test database exists
psql -U postgres -h localhost -c "\l" | grep sapbasic_test
```

### Issue: "Port 3001 already in use"
```bash
# Kill process using port 3001
lsof -i :3001
kill -9 <PID>
```

### Issue: "Module not found"
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Issue: "E2E tests timeout"
```bash
# Increase timeout in playwright.config.ts
timeout: 30000  // 30 seconds
```

## Test Coverage Goals

| Module | Target | Current |
|--------|--------|---------|
| Auth Service | 80% | - |
| Permission Guard | 85% | - |
| API Service | 80% | - |
| Auth Context | 75% | - |
| **Overall** | **80%** | - |

## Next Steps

1. Run backend unit tests
2. Run backend integration tests
3. Run frontend unit tests
4. Run frontend E2E tests
5. Check coverage reports
6. Fix any failing tests
7. Deploy to test environment

## Getting Help

- Check test output for specific error messages
- Review test file comments for test logic
- Check troubleshooting section in COMPREHENSIVE_TESTING_REPORT.md
- Review GitHub issues for known problems
