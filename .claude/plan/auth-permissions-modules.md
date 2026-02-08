# 认证、权限和模块扩展 - 实现计划

## 任务范围

### 1. JWT认证系统
- 后端: NestJS JWT认证模块
- 前端: 认证上下文和拦截器
- 登录/登出流程

### 2. 权限检查系统
- 后端: 权限守卫和装饰器
- 前端: 权限检查组件
- 多层权限防御

### 3. 新增模块
- Departments (部门管理)
- Roles (角色管理)
- 完整的CRUD操作

## 实现步骤

### 后端 (NestJS)
1. JWT认证模块 (auth.module.ts, auth.service.ts, auth.controller.ts)
2. JWT策略和守卫
3. 权限装饰器和守卫
4. Departments模块
5. Roles模块
6. 权限检查中间件

### 前端 (Next.js)
1. 认证服务和上下文
2. 登录页面集成
3. 权限检查组件
4. Departments和Roles页面
5. Schema定义

## 关键文件

### 后端
- backend/src/auth/auth.module.ts
- backend/src/auth/auth.service.ts
- backend/src/auth/auth.controller.ts
- backend/src/auth/jwt.strategy.ts
- backend/src/auth/jwt-auth.guard.ts
- backend/src/auth/roles.guard.ts
- backend/src/auth/roles.decorator.ts
- backend/src/departments/department.entity.ts
- backend/src/departments/departments.service.ts
- backend/src/departments/departments.controller.ts
- backend/src/departments/departments.module.ts
- backend/src/roles/role.entity.ts
- backend/src/roles/roles.service.ts
- backend/src/roles/roles.controller.ts
- backend/src/roles/roles.module.ts

### 前端
- src/lib/auth-service.ts
- src/core/auth/auth-context.ts (更新)
- src/app/login/page.tsx (更新)
- src/app/admin/departments/page.tsx
- src/app/admin/roles/page.tsx
- public/specs/objects/department.json (更新)
- public/specs/objects/role.json
- public/specs/views/department-list.json
- public/specs/views/role-list.json

## 预期输出

✅ 完整的JWT认证系统
✅ 权限检查和守卫
✅ Departments和Roles模块
✅ 前后端集成
✅ 类型安全和验证
