# Speckit v1.0 ERP Frontend Runtime

Business-Agnostic Enterprise ERP Frontend Runtime - Phase 1 Implementation

## 项目结构

```
speckit/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   ├── login/
│   │   │   └── page.tsx        # Login page
│   │   └── globals.css         # Global styles
│   ├── core/                   # Frontend Runtime Core (禁止业务代码)
│   │   ├── auth/               # 身份 & 权限
│   │   │   ├── types.ts
│   │   │   ├── context.ts
│   │   │   └── permission-guard.ts
│   │   ├── organization/       # 组织模型
│   │   │   ├── types.ts
│   │   │   └── context.ts
│   │   ├── navigation/         # 菜单 & 路由
│   │   │   ├── types.ts
│   │   │   └── menu-resolver.ts
│   │   └── page-model/         # 页面模型
│   │       ├── types.ts
│   │       └── page-registry.ts
│   ├── lib/                    # 工具 & 适配器
│   │   └── api-adapter/        # API 适配器
│   │       ├── types.ts
│   │       ├── mock-store.ts
│   │       └── http-adapter.ts
│   ├── components/             # 通用 UI 组件 (待实现)
│   ├── features/               # 业务模块 (待实现)
│   └── layouts/                # 布局系统 (待实现)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── .env.example
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd speckit
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 4. 构建生产版本

```bash
npm run build
npm start
```

## 核心模块说明

### Auth（身份和权限）

- **types.ts**: 用户、会话、权限类型定义
- **context.ts**: React Context 用于系统级身份状态
- **permission-guard.ts**: 权限检查和访问控制

**使用示例**:
```typescript
import { useAuth } from '@/core/auth/context'
import { PermissionGuard } from '@/core/auth/permission-guard'

function MyComponent() {
  const { user, isAuthenticated } = useAuth()
  const guard = new PermissionGuard({ user })

  if (guard.has('user.edit')) {
    // 显示编辑按钮
  }
}
```

### Organization（组织）

- **types.ts**: 组织、部门类型定义
- **context.ts**: 组织上下文和切换

### Navigation（导航）

- **types.ts**: 菜单项、导航状态类型
- **menu-resolver.ts**: 动态菜单生成和权限过滤

### Page Model（页面模型）

- **types.ts**: 页面类型、元数据定义
- **page-registry.ts**: 页面注册表

### API Adapter（API 适配器）

- **types.ts**: API 接口定义
- **mock-store.ts**: 开发用 Mock 存储
- **http-adapter.ts**: HTTP 请求适配器

## 架构原则

### 1. 状态管理边界

- ✓ React Context 用于系统级状态（Auth/Theme/Navigation）
- ✗ React Context 禁止用于业务数据
- 业务数据通过 Server Components 和 URL 状态流动

### 2. 权限优先

所有操作都必须检查权限：
1. 路由级别（Server Component）
2. 组件级别（Client Component）
3. API 级别（API Adapter）
4. 状态级别（State × Role × Action）

### 3. 业务无关

- `core/` 目录禁止包含业务逻辑
- 所有业务模块放在 `features/` 目录
- 使用接口和抽象层解耦

## 下一步

### Phase 2: Schema 系统 + 页面模型（第 3-4 周）

- [ ] Schema 定义系统（Object/View/Page Schema）
- [ ] Schema Resolver 实现
- [ ] 动态页面渲染引擎
- [ ] 表单生成器（SchemaForm）
- [ ] 列表生成器（SchemaList）

### Phase 3: 状态机 + 工作流（第 5-6 周）

- [ ] 状态机引擎（StateMachine）
- [ ] 状态定义系统
- [ ] 工作流轻量实现
- [ ] 审批流程 UI

### Phase 4: 参考实现模块（第 7-8 周）

- [ ] 用户管理模块
- [ ] 角色 & 权限管理
- [ ] 部门管理
- [ ] 菜单管理

## 开发指南

### 添加新的权限

在 `src/core/auth/types.ts` 中定义权限：

```typescript
export interface User {
  permissions: string[] // e.g., ['user.list', 'user.edit', 'user.delete']
}
```

### 添加新的菜单项

使用 `MenuResolver` 动态生成菜单：

```typescript
const resolver = new MenuResolver()
const menu = await resolver.resolveMenu({
  permissions: user.permissions,
  organizationId: user.organizationId
})
```

### 使用 API Adapter

```typescript
import { MockStore } from '@/lib/api-adapter/mock-store'

const api = new MockStore({
  delay: 100,
  data: {
    users: [{ id: '1', name: 'Admin' }]
  }
})

const users = await api.get('/users')
```

## 测试

```bash
npm run test
npm run test:watch
```

## 类型检查

```bash
npm run type-check
```

## 许可证

MIT
