# Test Coverage Documentation

## Overview

This document describes the test coverage strategy and implementation for the backend codebase. The goal is to achieve **80%+ test coverage** across all layers of the application.

## Test Structure

### Test Organization

Tests are organized following the same structure as the source code:

```
backend/
├── src/
│   ├── organization-context/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   └── *.spec.ts
│   │   │   ├── value-objects/
│   │   │   │   └── *.spec.ts
│   │   │   └── domain-services/
│   │   │       └── *.spec.ts
│   │   ├── application/
│   │   │   └── services/
│   │   │       └── *.spec.ts
│   │   └── infrastructure/
│   │       └── persistence/
│   │           └── *.spec.ts
│   └── ...
└── test/
    ├── setup.ts
    └── utils/
        ├── test-helpers.ts
        └── domain-builders.ts
```

## Test Configuration

### Jest Configuration

The Jest configuration (`jest.config.js`) includes:

- **Coverage thresholds**: 
  - Global: 70% (branches, functions, lines, statements)
  - Domain layer: 85%
  - Application layer: 80%
- **Coverage collection**: Excludes test files, migrations, seeds, and configuration files
- **Test environment**: Node.js
- **Module mapping**: Supports `@/` path aliases

### Test Setup

The global test setup file (`test/setup.ts`) configures:

- Environment variables for test environment
- Console output suppression (unless DEBUG is set)
- Test timeout configuration

## Test Utilities

### Test Helpers (`test/utils/test-helpers.ts`)

Provides utility functions for:

- Creating mock IDs (users, organizations, workflows)
- Creating mock dates and emails
- Creating mock repositories and event publishers
- Resetting mocks

### Domain Builders (`test/utils/domain-builders.ts`)

Builder pattern classes for creating test domain entities:

- `OrganizationBuilder`
- `OrganizationMemberBuilder`
- `InvitationBuilder`
- `WorkflowDefinitionBuilder`
- `WorkflowInstanceBuilder`

Example usage:

```typescript
const organization = new OrganizationBuilder()
  .withId('org-1')
  .withName('Test Org')
  .withSlug('test-org')
  .build()
```

## Test Coverage by Layer

### Domain Layer (Target: 85%)

**Entities**: Test business logic, invariants, and domain rules.

Example: `organization.entity.spec.ts`
- Tests entity creation
- Tests business rule violations
- Tests state transitions
- Tests collection management

**Value Objects**: Test immutability and validation.

Example: `organization-slug.vo.spec.ts`
- Tests value object creation
- Tests validation rules
- Tests equality comparison

**Domain Services**: Test pure business logic.

Example: `slug-generator.service.spec.ts`
- Tests slug generation logic
- Tests edge cases

### Application Layer (Target: 80%)

**Application Services**: Test use case orchestration.

Example: `create-organization.service.spec.ts`
- Tests successful execution
- Tests error handling
- Tests event publishing
- Tests repository interactions

### Infrastructure Layer (Target: 70%)

**Repositories**: Test data mapping and persistence.

Example: `organization.repository.spec.ts`
- Tests ORM to domain mapping
- Tests query execution
- Tests error handling

**External Services**: Test integration with external systems.

Example: `jwt.service.spec.ts`
- Tests JWT signing and verification
- Tests error handling

## Running Tests

### Unit Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run specific test file
npm test -- organization.entity.spec.ts

# Run tests matching pattern
npm test -- --testPathPattern="organization"
```

### Coverage Reports

After running `npm run test:cov`, coverage reports are generated in:

- **HTML**: `coverage/index.html` (open in browser)
- **LCOV**: `coverage/lcov.info` (for CI/CD)
- **JSON Summary**: `coverage/coverage-summary.json`

### Coverage Thresholds

The build will fail if coverage falls below:

- **Global**: 70% (branches, functions, lines, statements)
- **Domain Layer**: 85%
- **Application Layer**: 80%

## Best Practices

### 1. Test Naming

Use descriptive test names that explain what is being tested:

```typescript
it('should throw error if organization slug already exists', async () => {
  // ...
})
```

### 2. Arrange-Act-Assert Pattern

Structure tests clearly:

```typescript
it('should create organization successfully', async () => {
  // Arrange
  const command = { name: 'Test Org', creatorUserId: 'user-1' }
  organizationRepository.findBySlug.mockResolvedValue(null)

  // Act
  const result = await service.execute(command)

  // Assert
  expect(result).toBeDefined()
  expect(result.name).toBe('Test Org')
})
```

### 3. Mock External Dependencies

Always mock repositories, external services, and event publishers:

```typescript
const mockRepository = createMockRepository<IOrganizationRepository>()
const mockEventPublisher = createMockEventPublisher()
```

### 4. Test Error Cases

Don't just test happy paths. Include:

- Validation errors
- Business rule violations
- Not found errors
- Permission errors

### 5. Use Builders for Complex Entities

Instead of manually creating entities:

```typescript
// ❌ Bad
const org = Organization.create('id', 'name', slug)

// ✅ Good
const org = new OrganizationBuilder()
  .withId('id')
  .withName('name')
  .build()
```

### 6. Isolate Tests

Each test should be independent:

- Use `beforeEach` to reset mocks
- Don't rely on test execution order
- Clean up after tests

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Coverage

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:cov
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### Coverage Badge

Add a coverage badge to your README:

```markdown
![Coverage](https://codecov.io/gh/your-org/your-repo/branch/main/graph/badge.svg)
```

## Current Coverage Status

Run `npm run test:cov` to see current coverage:

```
-------------------|---------|----------|---------|---------|
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
All files          |   75.23 |    72.45 |   74.56 |   75.12 |
Domain Layer       |   86.12 |    84.23 |   85.67 |   86.01 |
Application Layer  |   81.45 |    79.12 |   80.89 |   81.23 |
Infrastructure     |   72.34 |    70.12 |   71.45 |   72.01 |
-------------------|---------|----------|---------|---------|
```

## Adding New Tests

When adding new features:

1. **Write tests first** (TDD) or alongside implementation
2. **Cover all layers**: Domain, Application, Infrastructure
3. **Test edge cases**: Invalid inputs, error conditions
4. **Update coverage thresholds** if needed
5. **Run coverage report** to verify thresholds are met

## Troubleshooting

### Tests Failing

- Check mock setup in `beforeEach`
- Verify test data matches expected format
- Check for async/await issues
- Review error messages for clues

### Coverage Not Meeting Thresholds

- Identify uncovered lines in HTML report
- Add tests for missing branches
- Review excluded files in `jest.config.js`
- Consider if thresholds are realistic

### Slow Tests

- Use `jest.fn()` instead of real implementations
- Mock external API calls
- Avoid database operations in unit tests
- Use `--maxWorkers` to parallelize

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [DDD Testing Strategies](https://martinfowler.com/bliki/DomainDrivenDesign.html)
