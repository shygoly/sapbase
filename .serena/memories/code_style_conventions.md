# Code Style and Conventions

## TypeScript/JavaScript Standards

### Naming Conventions
- **Files**: kebab-case (e.g., `user-form.tsx`, `auth-service.ts`)
- **Components**: PascalCase (e.g., `UserForm`, `AuthProvider`)
- **Functions/Variables**: camelCase (e.g., `getUserData`, `isAuthenticated`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`, `MAX_RETRIES`)
- **Types/Interfaces**: PascalCase (e.g., `User`, `AuthContext`)

### File Organization
- **Components**: `src/components/` - Reusable UI components
- **Pages**: `src/app/` - Next.js pages and layouts
- **Features**: `src/features/` - Feature-specific modules
- **Core**: `src/core/` - Auth, state, menu, schema systems
- **Lib**: `src/lib/` - Utilities, API client, helpers
- **Types**: `src/types/` - TypeScript type definitions

### React/Next.js Patterns
- Use functional components with hooks
- Prefer composition over inheritance
- Use React Hook Form for forms with Zod validation
- Use Zustand for global state management
- Use shadcn/ui components for UI
- Use TypeScript strict mode

### Error Handling
- Always wrap errors with context
- Use try-catch for async operations
- Return meaningful error messages
- Log errors for debugging

### Type Hints
- Always use TypeScript types
- Avoid `any` type (use `unknown` if necessary)
- Export types from modules
- Use generics for reusable components

### Comments and Docstrings
- Add comments only for non-obvious logic
- Use JSDoc for exported functions/components
- Keep comments up-to-date with code changes

## Code Quality Standards

### Imports
- Group imports: React → External libraries → Internal modules
- Use absolute imports with `@/` alias
- Remove unused imports

### Formatting
- Use Prettier for automatic formatting
- Line length: 100 characters (configurable)
- Use 2 spaces for indentation
- Use single quotes for strings

### Testing
- Write tests for critical business logic
- Use Playwright for E2E tests
- Aim for 80%+ code coverage
- Use descriptive test names

## Frontend-Specific Patterns

### Component Structure
```typescript
// Imports
import { useState } from 'react';
import { Button } from '@/components/ui/button';

// Types
interface ComponentProps {
  title: string;
  onSubmit: (data: FormData) => void;
}

// Component
export function MyComponent({ title, onSubmit }: ComponentProps) {
  const [state, setState] = useState('');
  
  return (
    <div>
      <h1>{title}</h1>
      {/* JSX */}
    </div>
  );
}
```

### Form Handling
- Use React Hook Form with Zod schemas
- Define schemas in separate files
- Use `useForm` hook for form state
- Validate on submit

### State Management
- Use Zustand stores for global state
- Keep stores focused and small
- Use selectors for derived state
- Avoid prop drilling

### API Integration
- Use centralized API client
- Handle errors consistently
- Use TypeScript for API responses
- Cache responses when appropriate
