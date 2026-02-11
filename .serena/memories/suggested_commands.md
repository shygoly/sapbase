# Suggested Commands for Development

## Frontend Development (speckit/)

### Running the Application
```bash
# Development mode (frontend only)
npm run dev:frontend

# Production build
npm run build

# Start production server
npm start
```

### Code Quality
```bash
# Linting
npm run lint

# Fix linting issues
npm run lint:fix

# Strict linting (no warnings)
npm run lint:strict

# Format code
npm run format

# Check formatting
npm run format:check
```

### Testing
```bash
# Run E2E tests with Playwright
npm run e2e

# Run tests in headed mode
npm run e2e:headed
```

## Backend Development (backend/)

### Running the Application
```bash
# Development mode with hot reload
npm run start:dev

# Production build
npm run build

# Start production server
npm start
```

### Database
```bash
# Run migrations
npm run migration:run

# Generate migration
npm run migration:generate

# Revert migration
npm run migration:revert
```

## Full Stack Development

### Development Mode (Both Frontend + Backend)
```bash
# From root directory
npm run dev

# This runs concurrently:
# - Frontend: npm run dev --workspace speckit
# - Backend: npm run start:dev --workspace backend
```

### Build All Workspaces
```bash
npm run build
```

### Lint All Workspaces
```bash
npm run lint
```

## Git Workflow
```bash
# Check status
git status

# View changes
git diff

# Stage changes
git add [files]

# Commit with conventional format
git commit -m "feat: description"

# Push to remote
git push -u origin [branch]
```

## Useful Utilities
```bash
# List files in directory
ls -la

# Find files by pattern
find . -name "*.tsx" -type f

# Search for text in files
grep -r "search_term" src/

# View file contents
cat [file]

# Edit files
nano [file]  # or vim, code, etc.
```
