# Speckit ERP - 项目整体架构

> 完整的企业ERP系统 - 前端、后端、共享模块一体化架构
>
> 更新日期：2026-02-07

---

## 📦 项目结构概览

```
everythingclaude/
├── shared-schemas/              # 🔗 共享数据模型（前后端统一）
│   ├── src/
│   │   ├── v1/
│   │   │   ├── common.ts        # 基础类型、枚举、权限定义
│   │   │   ├── user.ts          # 用户相关接口
│   │   │   ├── department.ts    # 部门相关接口
│   │   │   ├── role.ts          # 角色相关接口
│   │   │   ├── audit-log.ts     # 审计日志接口
│   │   │   ├── settings.ts      # 系统设置接口
│   │   │   ├── permissions.ts   # 权限管理接口
│   │   │   └── index.ts         # 导出所有类型
│   │   └── index.ts
│   ├── dist/                    # 编译输出
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                     # 🔙 NestJS 后端服务
│   ├── src/
│   │   ├── main.ts              # 应用入口
│   │   ├── app.module.ts        # 应用模块
│   │   ├── common/
│   │   │   ├── filters/         # 全局异常过滤器
│   │   │   ├── guards/          # 认证/授权守卫
│   │   │   └── decorators/      # 自定义装饰器
│   │   ├── auth/
│   │   │   ├── auth.service.ts  # 认证业务逻辑
│   │   │   ├── auth.controller.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   └── auth.module.ts
│   │   ├── users/
│   │   │   ├── user.entity.ts   # 用户数据库实体
│   │   │   ├── users.service.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.module.ts
│   │   │   └── dto/
│   │   │       ├── create-user.dto.ts
│   │   │       └── update-user.dto.ts
│   │   ├── departments/
│   │   │   ├── department.entity.ts
│   │   │   ├── departments.service.ts
│   │   │   ├── departments.controller.ts
│   │   │   ├── departments.module.ts
│   │   │   └── dto/
│   │   ├── roles/
│   │   │   ├── role.entity.ts
│   │   │   ├── roles.service.ts
│   │   │   ├── roles.controller.ts
│   │   │   ├── roles.module.ts
│   │   │   └── dto/
│   │   ├── audit-logs/
│   │   │   ├── audit-log.entity.ts
│   │   │   ├── audit-logs.service.ts
│   │   │   ├── audit-logs.controller.ts
│   │   │   └── audit-logs.module.ts
│   │   ├── settings/
│   │   │   ├── settings.entity.ts
│   │   │   ├── settings.service.ts
│   │   │   ├── settings.controller.ts
│   │   │   └── settings.module.ts
│   │   ├── permissions/
│   │   │   ├── permissions.entity.ts
│   │   │   ├── permissions.service.ts
│   │   │   ├── permissions.controller.ts
│   │   │   └── permissions.module.ts
│   │   └── database/
│   │       ├── migrations/      # 数据库迁移
│   │       └── seeds/           # 数据库种子
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── README.md
│
├── speckit/                     # 🎨 Next.js 前端应用
│   ├── src/
│   │   ├── app/                 # Next.js App Router
│   │   │   ├── layout.tsx       # 根布局
│   │   │   ├── page.tsx         # 首页
│   │   │   ├── login/
│   │   │   │   └── page.tsx     # 登录页面
│   │   │   ├── admin/
│   │   │   │   ├── users/
│   │   │   │   │   └── page.tsx # 用户管理
│   │   │   │   ├── roles/
│   │   │   │   │   └── page.tsx # 角色管理
│   │   │   │   ├── departments/
│   │   │   │   │   └── page.tsx # 部门管理
│   │   │   │   └── layout.tsx   # 管理后台布局
│   │   │   └── globals.css      # 全局样式
│   │   ├── components/
│   │   │   ├── ui/              # shadcn/ui 组件库
│   │   │   │   ├── button.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── alert-dialog.tsx
│   │   │   │   ├── pagination.tsx
│   │   │   │   ├── breadcrumb.tsx
│   │   │   │   ├── date-picker.tsx
│   │   │   │   ├── radio-group.tsx
│   │   │   │   ├── switch.tsx
│   │   │   │   └── [其他组件]/
│   │   │   ├── schema-list.tsx  # 动态列表组件
│   │   │   ├── schema-form.tsx  # 动态表单组件
│   │   │   ├── sidebar.tsx      # 侧边栏
│   │   │   ├── header.tsx       # 顶部导航
│   │   │   └── protected-route.tsx # 权限保护路由
│   │   ├── core/
│   │   │   ├── auth/
│   │   │   │   ├── hooks.ts     # useAuth, usePermission
│   │   │   │   └── context.ts   # AuthContext
│   │   │   ├── store/           # Zustand stores
│   │   │   │   ├── ui.store.ts
│   │   │   │   └── hooks.ts
│   │   │   └── api/
│   │   │       └── client.ts    # API 客户端配置
│   │   ├── lib/
│   │   │   ├── auth-service.ts  # 认证服务
│   │   │   ├── api-service.ts   # API 服务
│   │   │   ├── utils.ts         # 工具函数
│   │   │   └── validators.ts    # Zod schemas
│   │   ├── features/
│   │   │   ├── users/
│   │   │   │   ├── api.ts
│   │   │   │   ├── components/
│   │   │   │   └── hooks.ts
│   │   │   ├── departments/
│   │   │   │   ├── api.ts
│   │   │   │   ├── components/
│   │   │   │   └── hooks.ts
│   │   │   ├── roles/
│   │   │   │   ├── api.ts
│   │   │   │   ├── components/
│   │   │   │   └── hooks.ts
│   │   │   ├── audit-logs/
│   │   │   │   ├── api.ts
│   │   │   │   ├── components/
│   │   │   │   └── hooks.ts
│   │   │   └── system-settings/
│   │   │       ├── api.ts
│   │   │       ├── components/
│   │   │       └── hooks.ts
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useForm.ts
│   │   │   └── [其他 hooks]/
│   │   └── types/
│   │       ├── auth.ts
│   │       ├── api.ts
│   │       └── [其他类型]/
│   ├── public/                  # 静态资源
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.js
│   ├── .env.example
│   └── README.md
│
├── package.json                 # 根 package.json（monorepo 配置）
├── tsconfig.json                # 根 tsconfig.json
└── README.md
```

---

## 🔗 数据流向

### 前端 → 后端

```
Frontend (speckit)
    ↓
API Service (lib/api-service.ts)
    ↓
HTTP Request (Axios)
    ↓
Backend (NestJS)
    ↓
Controller → Service → Entity → Database
```

### 后端 → 前端

```
Database
    ↓
Entity (TypeORM)
    ↓
Service (业务逻辑)
    ↓
Controller (API 端点)
    ↓
HTTP Response (JSON)
    ↓
Frontend (API Service)
    ↓
Components (UI 渲染)
```

---

## 📊 共享数据模型（shared-schemas）

### 核心类型

**common.ts**
- `EntityStatus` - 实体状态枚举
- `UserStatus` - 用户状态枚举
- `AuditAction` - 审计操作枚举
- `BaseEntity` - 基础实体接口
- `BaseAuditEntity` - 审计实体接口
- `Permission` - 权限类型
- `PermissionString` - 权限字符串类型

**user.ts**
- `User` - 用户接口
- `UserEntity` - 用户数据库实体
- `CreateUserInput` - 创建用户输入
- `UpdateUserInput` - 更新用户输入
- `LoginRequest` - 登录请求
- `LoginResponse` - 登录响应
- `AuthUser` - 认证用户

**department.ts**
- `Department` - 部门接口
- `CreateDepartmentInput` - 创建部门输入
- `UpdateDepartmentInput` - 更新部门输入

**role.ts**
- `Role` - 角色接口
- `CreateRoleInput` - 创建角色输入
- `UpdateRoleInput` - 更新角色输入

**audit-log.ts**
- `AuditLog` - 审计日志接口
- `CreateAuditLogInput` - 创建审计日志输入
- `AuditLogFilter` - 审计日志过滤器

**settings.ts**
- `SystemSettings` - 系统设置接口
- `SettingsGroup` - 设置分组
- `AppearanceSettings` - 外观设置
- `LocalizationSettings` - 本地化设置
- `NotificationSettings` - 通知设置
- `SecuritySettings` - 安全设置

**permissions.ts**
- `Permission` - 权限接口
- `PermissionGroup` - 权限分组
- `RolePermission` - 角色权限关联
- `UserPermission` - 用户权限关联

---

## 🔐 认证与授权流程

### 登录流程

```
1. 用户输入邮箱/密码
   ↓
2. 前端调用 POST /api/auth/login
   ↓
3. 后端验证凭证
   ↓
4. 生成 JWT Token
   ↓
5. 返回 Token + User 信息
   ↓
6. 前端保存 Token 到 localStorage
   ↓
7. 后续请求在 Authorization header 中携带 Token
```

### 权限检查流程

```
1. 用户执行操作（如删除用户）
   ↓
2. 前端检查权限 (usePermission hook)
   ↓
3. 如果有权限，调用 API
   ↓
4. 后端再次检查权限 (JWT Guard)
   ↓
5. 如果有权限，执行操作
   ↓
6. 记录审计日志
   ↓
7. 返回结果
```

---

## 🛠️ 技术栈

### 前端 (speckit)

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | ^15.x | 全栈框架 |
| React | ^19.x | UI 库 |
| TypeScript | ^5.x | 类型系统 |
| Tailwind CSS | ^3.x | 样式框架 |
| shadcn/ui | latest | UI 组件库 |
| React Hook Form | ^7.x | 表单管理 |
| Zod | ^3.x | 数据验证 |
| Zustand | ^4.x | 状态管理 |
| Axios | ^1.x | HTTP 客户端 |

### 后端 (backend)

| 技术 | 版本 | 用途 |
|------|------|------|
| NestJS | ^10.x | 后端框架 |
| TypeScript | ^5.x | 类型系统 |
| TypeORM | ^0.3.x | ORM |
| PostgreSQL | 14+ | 数据库 |
| JWT | - | 认证 |
| bcrypt | ^5.x | 密码加密 |
| class-validator | ^0.14.x | 数据验证 |

### 共享 (shared-schemas)

| 技术 | 版本 | 用途 |
|------|------|------|
| TypeScript | ^5.x | 类型系统 |

---

## 📝 API 端点

### 认证

```
POST   /api/auth/login          # 登录
POST   /api/auth/logout         # 登出
POST   /api/auth/refresh        # 刷新 Token
GET    /api/auth/me             # 获取当前用户
```

### 用户管理

```
GET    /api/users               # 获取所有用户
GET    /api/users/:id           # 获取单个用户
POST   /api/users               # 创建用户
PUT    /api/users/:id           # 更新用户
DELETE /api/users/:id           # 删除用户
```

### 部门管理

```
GET    /api/departments         # 获取所有部门
GET    /api/departments/:id     # 获取单个部门
POST   /api/departments         # 创建部门
PUT    /api/departments/:id     # 更新部门
DELETE /api/departments/:id     # 删除部门
```

### 角色管理

```
GET    /api/roles               # 获取所有角色
GET    /api/roles/:id           # 获取单个角色
POST   /api/roles               # 创建角色
PUT    /api/roles/:id           # 更新角色
DELETE /api/roles/:id           # 删除角色
```

### 审计日志

```
GET    /api/audit-logs          # 获取审计日志
GET    /api/audit-logs/:id      # 获取单个日志
```

### 系统设置

```
GET    /api/settings            # 获取所有设置
GET    /api/settings/:key       # 获取单个设置
PUT    /api/settings/:key       # 更新设置
```

### 权限管理

```
GET    /api/permissions         # 获取所有权限
GET    /api/permissions/:id     # 获取单个权限
POST   /api/permissions         # 创建权限
PUT    /api/permissions/:id     # 更新权限
DELETE /api/permissions/:id     # 删除权限
```

---

## 🚀 开发工作流

### 启动开发环境

```bash
# 在项目根目录
npm install                     # 安装所有依赖

# 启动前后端
npm run dev                     # 同时启动前端和后端

# 或分别启动
npm run dev:frontend            # 仅启动前端 (port 3000)
npm run dev:backend             # 仅启动后端 (port 3001)
```

### 构建生产版本

```bash
# 构建所有包
npm run build

# 或分别构建
npm run build --workspace speckit
npm run build --workspace backend
npm run build --workspace shared-schemas
```

---

## 📦 Monorepo 工作区

### 工作区配置

```json
{
  "workspaces": [
    "shared-schemas",
    "speckit",
    "backend"
  ]
}
```

### 工作区依赖

- **speckit** 依赖 **shared-schemas**
- **backend** 依赖 **shared-schemas**
- **shared-schemas** 独立，无依赖

---

## 🔄 数据同步

### 前后端数据一致性

1. **共享类型定义** - 使用 shared-schemas 确保类型一致
2. **API 契约** - 后端 DTO 继承自 shared-schemas
3. **前端类型** - 前端 API 响应类型来自 shared-schemas
4. **验证规则** - 前后端使用相同的验证规则

### 数据库迁移

```bash
# 后端数据库迁移
cd backend
npm run typeorm migration:generate -- -n MigrationName
npm run typeorm migration:run
```

---

## 📚 关键文件说明

### 前端关键文件

| 文件 | 说明 |
|------|------|
| `speckit/src/lib/api-service.ts` | API 服务，所有 HTTP 请求的入口 |
| `speckit/src/lib/auth-service.ts` | 认证服务，Token 管理 |
| `speckit/src/core/auth/hooks.ts` | 认证 hooks，useAuth, usePermission |
| `speckit/src/components/schema-form.tsx` | 动态表单组件 |
| `speckit/src/components/schema-list.tsx` | 动态列表组件 |

### 后端关键文件

| 文件 | 说明 |
|------|------|
| `backend/src/auth/auth.service.ts` | 认证业务逻辑 |
| `backend/src/common/filters/http-exception.filter.ts` | 全局异常处理 |
| `backend/src/users/user.entity.ts` | 用户数据库实体 |

### 共享关键文件

| 文件 | 说明 |
|------|------|
| `shared-schemas/src/v1/common.ts` | 基础类型和枚举 |
| `shared-schemas/src/v1/user.ts` | 用户相关类型 |
| `shared-schemas/src/index.ts` | 导出所有类型 |

---

## 🎯 下一步计划

- [ ] 更新后端 DTOs 使用 shared-schemas
- [ ] 更新前端 API 类型使用 shared-schemas
- [ ] 添加更多 shadcn/ui 组件应用
- [ ] 实现深色模式支持
- [ ] 添加 E2E 测试
- [ ] 性能优化
- [ ] 文档完善

---

**版本历史**：
- v1.0 (2026-02-07): 初始架构文档，包含 shared-schemas 集成
