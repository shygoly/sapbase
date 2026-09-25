# Sapbase Project Overview

> 元上下文入口：[`docs/META_LANGUAGE.md`](../../docs/META_LANGUAGE.md)（项目元语：术语、不变量、文档真源）
> 与 [`openspec/project.md`](../../openspec/project.md)（项目上下文：技术栈、约定、约束）。
> 本文件为速览；三者冲突时以元语与 project.md 为准。

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
- **Authentication**: 自研 JWT（Bearer token，经 `lib/api/client.ts` 统一注入）
  ⚠️ `@clerk/*` 依赖仍在 `package.json` 但源码未使用，属模板残留，待清理
- **File Upload**: React-dropzone
- **Theme**: next-themes with light/dark mode
- **Error Tracking**: Sentry
- **Testing**: ⚠️ 当前无测试框架（`speckit-legacy/` 曾有 jest + Playwright，迁移中未带过来）
- **Package Manager**: npm（唯一锁文件 = 根 `package-lock.json`；`speckit/bun.lock` 已删除）

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

### Wasm Modules (wasm-modules/)
- Rust 1.95 编写的零能力原子模块（`no_std`、零依赖、`wasm32-unknown-unknown`）
- 准入闸：源码预检 / 静态白名单 / 双构建器复现构建 / 吊销
- 入库产物：`build/*.wasm` + `build/manifest.json`
- 详见 `wasm-modules/README.md`；与后端集成见 `openspec/changes/add-wasm-atomic-runtime/`

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
