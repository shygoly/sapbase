# Sapbase Project Overview

## Project Purpose
Business-Agnostic ERP Frontend Runtime (Speckit) - A monorepo containing:
- **Frontend**: Next.js 15 admin dashboard with role-based access control
- **Backend**: NestJS REST API with authentication and authorization
- **Shared Schemas**: TypeScript type definitions and validation schemas

## Core Positioning
- NOT industry-specific (no procurement, medical, manufacturing logic)
- NOT a backend engine (no BPM, financial, material management)
- NOT positioned as low-code platform
- Focus: Business-agnostic admin UI runtime for ERP systems

## Tech Stack

### Frontend (speckit/)
- **Framework**: Next.js 15 with App Router
- **UI Library**: Shadcn/ui components with Tailwind CSS v4
- **State Management**: Zustand (auth, permissions, menu, UI)
- **Forms**: React Hook Form + Zod validation
- **Authentication**: Clerk (JWT with Bearer tokens)
- **File Upload**: React-dropzone
- **Theme**: next-themes with light/dark mode
- **Error Tracking**: Sentry
- **Testing**: Playwright E2E tests
- **Package Manager**: npm (with bun.lock available)

### Backend (backend/)
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL (via TypeORM)
- **API Documentation**: Swagger/OpenAPI
- **Authentication**: JWT Bearer tokens
- **Validation**: Class-validator + class-transformer

### Shared (shared-schemas/)
- TypeScript type definitions
- Zod validation schemas
- Shared interfaces and DTOs

## Monorepo Structure
```
sapbase/
├── speckit/              # Next.js frontend
│   ├── src/
│   │   ├── app/         # Next.js pages and layouts
│   │   ├── components/  # React components
│   │   ├── core/        # Auth, state, menu, schema
│   │   ├── features/    # Feature modules
│   │   ├── lib/         # Utilities and API client
│   │   └── types/       # TypeScript types
│   └── package.json
├── backend/              # NestJS API
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   └── [modules]/   # Feature modules
│   └── package.json
├── shared-schemas/       # Shared types
└── package.json         # Root workspace config
```

## Key Features Implemented
- User management (CRUD)
- Role management with permissions
- Department management
- Audit logging
- System settings
- Permission-based menu filtering
- Batch operations on admin pages
- Data export functionality
