# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Speckit ERP is a full-stack enterprise resource planning system built with:
- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS, shadcn/ui, Zustand state management
- **Backend**: NestJS with PostgreSQL, TypeORM, WebSocket support
- **Shared**: TypeScript schemas package for type safety across frontend and backend
- **Monorepo**: npm workspaces with three packages: `speckit` (frontend), `backend`, `shared-schemas`

The system includes user management, role-based access control, departments, organizations, audit logging, and AI module integration.

## Development Commands

### Root Level (Monorepo)

```bash
npm run dev              # Start both frontend (port 3050) and backend (port 3001) concurrently
npm run dev:frontend    # Start only frontend
npm run dev:backend     # Start only backend
npm run build           # Build all workspaces
npm run lint            # Lint all workspaces
```

### Frontend (speckit/)

```bash
npm run dev             # Start Next.js dev server on port 3050
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Run ESLint
npm run lint:fix        # Fix linting issues
npm run format          # Format code with Prettier
```

### Backend (backend/)

```bash
npm run start:dev       # Start NestJS in watch mode
npm run build           # Build NestJS application
npm run test            # Run unit tests
npm run test:watch      # Run tests in watch mode
npm run test:cov        # Run tests with coverage report
npm run test:e2e        # Run E2E tests
npm run test:e2e:watch  # Run E2E tests in watch mode
npm run seed            # Run database seed script
npm run seed:test       # Run test data seed
npm run seed:mock       # Run mock data seed
npm run lint            # Run ESLint
npm run format          # Format code with Prettier
npm run generate:docs   # Generate OpenAPI and Postman docs
npm run migration:run   # Run pending database migrations
npm run migration:generate # Generate new migration from entities
```

### Database Setup

```bash
# Create database
createdb sapbasic

# Configure backend environment
cd backend
cp .env.example .env.local
# Edit .env.local with your database credentials

# Run migrations and seed data
npm run migration:run
npm run seed
```

## Architecture

### Monorepo Structure

```
sapbase/
├── shared-schemas/          # Shared TypeScript types and interfaces
│   └── src/                 # Type definitions used by both frontend and backend
├── speckit/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/            # Next.js app router pages
│   │   ├── components/      # React components (UI, features, layouts)
│   │   ├── core/           # Core functionality (auth, state, i18n, theme)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities and helpers
│   │   ├── types/          # TypeScript type definitions
│   │   └── styles/         # Global styles and theme configuration
│   └── package.json
├── backend/                 # NestJS backend application
│   ├── src/
│   │   ├── main.ts         # Application entry point
│   │   ├── app.module.ts   # Root module
│   │   ├── auth/           # Authentication (JWT, Passport)
│   │   ├── users/          # User management module
│   │   ├── roles/          # Role-based access control
│   │   ├── departments/    # Department management
│   │   ├── organizations/  # Organization/tenant management
│   │   ├── ai-modules/     # AI module integration
│   │   ├── ai-models/      # AI model management
│   │   ├── permissions/    # Permission system
│   │   ├── audit-logs/     # Audit logging
│   │   ├── websocket/      # WebSocket support
│   │   ├── cache/          # Redis caching layer
│   │   ├── common/         # Shared utilities, guards, interceptors
│   │   ├── migrations/     # Database migrations
│   │   ├── seeds/          # Database seed scripts
│   │   └── types/          # Backend-specific types
│   └── package.json
└── package.json             # Root monorepo configuration
```

### Key Architectural Patterns

**Frontend (Next.js)**
- App Router for file-based routing
- Zustand for global state management
- React Context for auth and theme
- shadcn/ui components with Tailwind CSS
- Middleware for authentication and request handling
- Socket.io client for real-time updates

**Backend (NestJS)**
- Modular architecture with feature modules
- TypeORM for database abstraction
- JWT authentication with Passport
- Role-based access control (RBAC) guards
- WebSocket gateway for real-time communication
- Redis caching for performance
- Swagger/OpenAPI documentation
- Database migrations with TypeORM

**Shared Types**
- `@speckit/shared-schemas` package provides type safety across frontend and backend
- Imported in both applications to ensure consistency

### Authentication Flow

1. User logs in via frontend login page
2. Backend validates credentials and returns JWT token
3. Frontend stores token and includes in Authorization header
4. Backend validates JWT on protected routes using Passport guards
5. User context available in both frontend and backend

### Database

- PostgreSQL database named `sapbasic`
- TypeORM for ORM and migrations
- Seed scripts for initial data setup
- Audit logging for all entity changes

## Important Files and Patterns

### Frontend Key Files

- `speckit/src/middleware.ts` - Request authentication and routing
- `speckit/src/core/auth/` - Authentication context and hooks
- `speckit/src/core/store/` - Zustand stores for global state
- `speckit/src/components/layout/` - Main layout components
- `speckit/src/app/` - Page routes and layouts

### Backend Key Files

- `backend/src/app.module.ts` - Root module with all feature imports
- `backend/src/auth/` - JWT strategy and authentication guards
- `backend/src/common/` - Shared guards, interceptors, decorators
- `backend/src/main.ts` - Application bootstrap and configuration
- `backend/src/migrations/` - Database schema migrations

### Environment Variables

**Backend (.env.local)**
```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=mac
DB_PASSWORD=
DB_NAME=sapbasic
PORT=3001
JWT_SECRET=your-secret-key
JWT_EXPIRATION=7d
```

**Frontend** - Uses backend API at `http://localhost:3001`

## Testing

### Backend Tests

```bash
# Unit tests
npm run test --workspace backend

# E2E tests
npm run test:e2e --workspace backend

# Coverage report
npm run test:cov --workspace backend

# Run specific test file
npm run test --workspace backend -- users.service.spec.ts
```

### Frontend Testing

Frontend uses Jest and Playwright for testing. Check `speckit/` for test configuration.

## API Documentation

- Swagger UI available at `http://localhost:3001/api/docs` when backend is running
- OpenAPI spec can be generated with `npm run generate:docs --workspace backend`
- Postman collection also generated for API testing

## WebSocket Support

Backend includes WebSocket gateway for real-time features:
- Located in `backend/src/websocket/`
- Frontend connects via Socket.io client
- Used for real-time notifications and updates

## Caching

Redis caching layer in backend:
- Cache module in `backend/src/cache/`
- Configured in app.module.ts
- Used for performance optimization on frequently accessed data

## Common Development Tasks

### Adding a New API Endpoint

1. Create/update entity in `backend/src/[feature]/[feature].entity.ts`
2. Create DTO in `backend/src/[feature]/dto/`
3. Add method to service in `backend/src/[feature]/[feature].service.ts`
4. Add route to controller in `backend/src/[feature]/[feature].controller.ts`
5. Add guard/decorator if permission-based
6. Test with `npm run test:e2e --workspace backend`

### Adding a New Frontend Page

1. Create page file in `speckit/src/app/[route]/page.tsx`
2. Create components in `speckit/src/components/[feature]/`
3. Use hooks from `speckit/src/hooks/` for data fetching
4. Add to navigation in `speckit/src/config/nav-config.ts` if needed
5. Test with `npm run dev --workspace speckit`

### Database Schema Changes

1. Modify entity in `backend/src/[feature]/[feature].entity.ts`
2. Generate migration: `npm run migration:generate --workspace backend -- -n MigrationName`
3. Review generated migration file in `backend/src/migrations/`
4. Run migration: `npm run migration:run --workspace backend`

## Debugging

### Backend Debugging

```bash
npm run start:debug --workspace backend
# Then attach debugger to port 9229
```

### Frontend Debugging

Use Next.js built-in debugging or browser DevTools. Check `speckit/` for debugging configuration.

## Performance Considerations

- Frontend uses Zustand for efficient state management
- Backend uses Redis caching for database queries
- WebSocket for real-time updates instead of polling
- TypeORM query optimization with relations and select
- Lazy loading and code splitting in Next.js

## Security

- JWT authentication on all protected routes
- Role-based access control (RBAC) guards
- Password hashing with bcrypt
- CORS configured in backend
- Input validation with class-validator
- SQL injection prevention via TypeORM parameterized queries

## Deployment

- Frontend: Deploy `speckit/` build to Vercel or similar
- Backend: Deploy `backend/` build to Node.js hosting
- Database: PostgreSQL instance (managed or self-hosted)
- Environment variables must be configured on deployment platform
