# Task Completion Checklist

## After Writing/Modifying Code

### 1. Code Quality
- [ ] Code follows project style guide
- [ ] No console.log statements left in production code
- [ ] No unused imports or variables
- [ ] TypeScript types are properly defined
- [ ] Error handling is implemented

### 2. Testing
- [ ] Unit tests written for new functions
- [ ] E2E tests updated if UI changed
- [ ] All tests pass locally
- [ ] Coverage meets 80%+ requirement

### 3. Linting and Formatting
```bash
# Run linting
npm run lint:fix

# Check formatting
npm run format:check

# Fix formatting
npm run format
```

### 4. Build Verification
```bash
# Build the project
npm run build

# Verify no build errors
```

### 5. Git Workflow
- [ ] Changes staged appropriately
- [ ] Commit message follows conventional format
- [ ] Commit message is descriptive
- [ ] No sensitive data in commit

### 6. Code Review
- [ ] Self-review changes before committing
- [ ] Check for security vulnerabilities
- [ ] Verify no breaking changes
- [ ] Update documentation if needed

## Commit Message Format

```
<type>: <description>

<optional body>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `docs`: Documentation changes
- `test`: Test additions/changes
- `chore`: Build, dependencies, etc.
- `perf`: Performance improvements
- `ci`: CI/CD changes

### Example
```
feat: add user batch delete functionality

- Implement batch delete endpoint
- Add checkbox selection to user list
- Add confirmation dialog
- Update audit logs

Closes #123
```

## Before Pushing to Remote

- [ ] All tests pass
- [ ] Build succeeds
- [ ] No linting errors
- [ ] Code is formatted
- [ ] Commit messages are clear
- [ ] Branch is up-to-date with main
- [ ] No merge conflicts

## Documentation Updates

- [ ] README updated if needed
- [ ] API documentation updated
- [ ] Type definitions documented
- [ ] Complex logic has comments
- [ ] Breaking changes documented
