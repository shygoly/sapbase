# Speckit v1.0 ERP Frontend Runtime - 实现规划

> **规划生成时间**: 2026-02-07
> **规划范围**: 完整实现所有 7 个能力域 + Schema 系统
> **实现周期**: 10 周（分 5 个阶段）

---

## 执行摘要

### 推荐方案：混合状态架构（Hybrid State Architecture）

**核心原则**：
- React Context 仅用于系统级状态（Auth/Theme/Navigation）
- 业务数据通过 Server Components 和 URL 状态流动
- 状态机作为纯函数（状态 + 规则 → 允许的操作）
- 权限优先执行模型（多层防御）

**技术栈确认**：
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- React Hook Form + API Adapter
- Schema-driven 页面生成

**可行性评估**：
| 能力域 | 可行性 | 复杂度 | 关键挑战 |
|--------|--------|--------|---------|
| Identity/Organization | ✓ 高 | 低-中 | JWT/Session 抽象、多组织上下文 |
| Authorization (RBAC) | ✓ 高 | 中 | 状态感知权限（State × Role × Action） |
| Navigation | ✓ 高 | 低 | 动态菜单生成、权限过滤 |
| Page Model | ✓ 高 | 中 | Schema → Component 映射 |
| Data Operations | ✓ 高 | 中-高 | API Adapter 抽象、乐观更新 |
| State & Workflow | ⚠ 中-高 | 高 | 无全局状态库的状态机设计 |
| System Capabilities | ✓ 高 | 低-中 | 标准模式（i18n/主题/日志） |

**结论**：所有 7 个能力域都可实现。State & Workflow 需要特别关注架构设计。

---

## 第一部分：架构决策

### 决策 1：状态管理边界

**问题**：规范禁止 React Context 用于业务数据，但状态机需要追踪业务状态。

**决策**：**派生状态模式（Derived State Pattern）**

```typescript
// ❌ 错误：业务数据在 Context
const OrderContext = createContext<Order>()

// ✓ 正确：状态从 props/URL 派生
function OrderDetail({ order }: { order: Order }) {
  const state = useStateMachine({
    currentState: order.status,
    definition: orderStateMachine
  })

  const canEdit = state.allows('edit')
  const canSubmit = state.allows('submit')
}
```

**理由**：
- 业务数据通过 props 向下流动（Server Components）
- 状态机是**纯函数**（状态 + 规则 → 允许的操作）
- 无全局状态污染
- 易于测试和推理

---

### 决策 2：Schema 解析策略

**问题**：页面、表单、列表必须从 Schema 生成。

**决策**：**三层 Schema 系统**

```typescript
// 第 1 层：Object Schema（数据结构）
interface ObjectSchema {
  name: string
  fields: FieldDefinition[]
  relations: Relation[]
  stateMachine?: StateMachineDefinition
}

// 第 2 层：View Schema（UI 布局）
interface ViewSchema {
  type: 'list' | 'form' | 'detail' | 'dashboard'
  object: string // 引用 ObjectSchema
  layout: LayoutDefinition
  permissions: PermissionRule[]
}

// 第 3 层：Page Schema（路由 + 元数据）
interface PageSchema {
  path: string
  view: string // 引用 ViewSchema
  metadata: PageMetadata
  lifecycle: LifecycleHooks
}
```

**实现**：
```typescript
export class SchemaResolver {
  async resolvePage(path: string): Promise<ResolvedPageSchema> {
    const pageSchema = await this.loadPageSchema(path)
    const viewSchema = await this.loadViewSchema(pageSchema.view)
    const objectSchema = await this.loadObjectSchema(viewSchema.object)

    return {
      page: pageSchema,
      view: viewSchema,
      object: objectSchema,
      permissions: this.mergePermissions([
        pageSchema.permissions,
        viewSchema.permissions,
        objectSchema.permissions
      ])
    }
  }
}
```

---

### 决策 3：权限执行模型

**问题**："Permission-First" 意味着所有可见性和操作都必须检查权限。

**决策**：**多层权限防御**

```
Layer 1: Route Guard (Server Component)
  ↓
Layer 2: Component Guard (Client Component)
  ↓
Layer 3: Action Guard (API Adapter)
  ↓
Layer 4: State-Aware Permission (State × Role × Action)
```

**实现**：
```typescript
// Layer 1: 路由守卫
export default async function UsersPage() {
  await requirePermission('user.list')
  // ...
}

// Layer 2: 组件守卫
function UserActions({ user }) {
  const { hasPermission } = usePermissions()
  return (
    <>
      {hasPermission('user.edit') && <EditButton />}
      {hasPermission('user.delete') && <DeleteButton />}
    </>
  )
}

// Layer 4: 状态感知权限
function canPerformAction(
  user: User,
  action: string,
  objectState: string
): boolean {
  const permission = `${objectState}.${action}` // e.g., "draft.edit"
  return user.permissions.includes(permission)
}
```

---

## 第二部分：核心能力域实现路线图

### Phase 1: 基础运行时骨架（第 1-2 周）

**目标**：建立核心运行时框架，验证架构可行性

**交付物**：
1. ✓ 项目初始化 + 目录结构
2. ✓ 核心模块骨架（auth/organization/navigation/page-model）
3. ✓ API Adapter 抽象层
4. ✓ Mock Store 实现
5. ✓ 基础权限系统

**关键文件结构**：
```
src/
├─ core/
│  ├─ auth/
│  │  ├─ types.ts          # User, Session, Permission types
│  │  ├─ context.ts        # AuthContext (system state)
│  │  ├─ hooks.ts          # useAuth, usePermissions
│  │  └─ permission-guard.ts
│  ├─ organization/
│  │  ├─ types.ts
│  │  ├─ context.ts
│  │  └─ hooks.ts
│  ├─ navigation/
│  │  ├─ types.ts
│  │  ├─ menu-resolver.ts
│  │  └─ hooks.ts
│  └─ page-model/
│     ├─ types.ts
│     └─ page-registry.ts
├─ lib/
│  ├─ api-adapter/
│  │  ├─ types.ts
│  │  ├─ adapter.ts
│  │  └─ mock-store.ts
│  └─ utils/
└─ app/
   ├─ layout.tsx
   ├─ page.tsx
   └─ login/
      └─ page.tsx
```

**验收标准**：
- [ ] 项目可启动，无构建错误
- [ ] AuthContext 可正常工作
- [ ] API Adapter 可调用 Mock Store
- [ ] 基础权限检查可工作

---

### Phase 2: Schema 系统 + 页面模型（第 3-4 周）

**目标**：实现 Schema-driven 页面生成能力

**交付物**：
1. ✓ Schema 定义系统（Object/View/Page Schema）
2. ✓ Schema Resolver 实现
3. ✓ 动态页面渲染引擎
4. ✓ 表单生成器（SchemaForm）
5. ✓ 列表生成器（SchemaList）

**关键文件**：
```
src/
├─ core/
│  └─ schema/
│     ├─ types.ts          # ObjectSchema, ViewSchema, PageSchema
│     ├─ resolver.ts       # SchemaResolver class
│     ├─ validator.ts      # Schema validation (Zod)
│     └─ registry.ts       # Component registry
├─ components/
│  ├─ schema-form.tsx      # Dynamic form from schema
│  ├─ schema-list.tsx      # Dynamic list from schema
│  ├─ schema-page.tsx      # Dynamic page layout
│  └─ fields/
│     ├─ input-field.tsx
│     ├─ select-field.tsx
│     ├─ date-field.tsx
│     └─ relation-field.tsx
└─ specs/
   ├─ objects/
   │  ├─ user.json
   │  ├─ role.json
   │  └─ department.json
   ├─ views/
   │  ├─ user-list.json
   │  ├─ user-form.json
   │  └─ user-detail.json
   └─ pages/
      ├─ users.json
      ├─ users-create.json
      └─ users-edit.json
```

**验收标准**：
- [ ] Schema 可从文件加载
- [ ] SchemaForm 可从 Object Schema 生成表单
- [ ] SchemaList 可从 Object Schema 生成列表
- [ ] 权限规则可应用到 Schema 字段

---

### Phase 3: 状态机 + 工作流（第 5-6 周）

**目标**：实现状态驱动的 UI 和业务流程

**交付物**：
1. ✓ 状态机引擎（StateMachine）
2. ✓ 状态定义系统
3. ✓ 工作流轻量实现
4. ✓ 审批流程 UI
5. ✓ 时间线视图

**关键文件**：
```
src/
├─ core/
│  ├─ state-machine/
│  │  ├─ types.ts
│  │  ├─ engine.ts
│  │  ├─ compiled-machine.ts
│  │  └─ hooks.ts
│  └─ workflow/
│     ├─ types.ts
│     ├─ workflow-engine.ts
│     └─ hooks.ts
├─ components/
│  ├─ state-badge.tsx
│  ├─ state-actions.tsx
│  ├─ workflow-timeline.tsx
│  └─ approval-form.tsx
└─ specs/
   └─ state-machines/
      ├─ order.json
      ├─ user.json
      └─ approval.json
```

**验收标准**：
- [ ] 状态机可定义状态和转移
- [ ] 状态转移可检查权限
- [ ] UI 可根据状态显示/隐藏字段
- [ ] 工作流可记录审批历史

---

### Phase 4: 参考实现模块（第 7-8 周）

**目标**：验证运行时完整性，提供参考实现

**交付物**：
1. ✓ 用户管理模块（CRUD + 权限）
2. ✓ 角色 & 权限管理模块
3. ✓ 部门管理模块
4. ✓ 菜单管理模块
5. ✓ 操作日志查看
6. ✓ 系统设置

**关键文件**：
```
src/
├─ features/
│  ├─ users/
│  │  ├─ page.tsx
│  │  ├─ components/
│  │  │  ├─ user-list.tsx
│  │  │  ├─ user-form.tsx
│  │  │  └─ user-detail.tsx
│  │  └─ api.ts
│  ├─ roles/
│  ├─ departments/
│  ├─ menus/
│  ├─ audit-logs/
│  └─ system-settings/
└─ app/
   ├─ admin/
   │  ├─ users/
   │  ├─ roles/
   │  ├─ departments/
   │  ├─ menus/
   │  ├─ audit-logs/
   │  └─ settings/
```

**验收标准**：
- [ ] 用户管理：增删改查 + 权限控制
- [ ] 角色管理：RBAC 模型完整
- [ ] 部门管理：组织树结构
- [ ] 菜单管理：动态菜单生成
- [ ] 日志查看：操作审计
- [ ] 系统设置：主题/语言/权限配置

---

### Phase 5: 系统级能力 + 优化（第 9-10 周）

**目标**：完善系统级功能，性能优化

**交付物**：
1. ✓ 国际化（i18n）系统
2. ✓ 主题 / 企业品牌定制
3. ✓ 全局错误处理
4. ✓ 系统消息 / 通知
5. ✓ 性能优化（缓存、代码分割）
6. ✓ 文档 + 示例

**关键文件**：
```
src/
├─ core/
│  ├─ i18n/
│  │  ├─ config.ts
│  │  ├─ translations/
│  │  │  ├─ en.json
│  │  │  └─ zh-CN.json
│  │  └─ hooks.ts
│  ├─ theme/
│  │  ├─ context.ts
│  │  ├─ themes/
│  │  │  ├─ light.ts
│  │  │  └─ dark.ts
│  │  └─ hooks.ts
│  ├─ error-handling/
│  │  ├─ error-boundary.tsx
│  │  └─ error-logger.ts
│  └─ notifications/
│     ├─ context.ts
│     ├─ toast.tsx
│     └─ hooks.ts
└─ docs/
   ├─ ARCHITECTURE.md
   ├─ SCHEMA_GUIDE.md
   ├─ STATE_MACHINE_GUIDE.md
   └─ EXAMPLES.md
```

**验收标准**：
- [ ] i18n 可切换语言
- [ ] 主题可自定义
- [ ] 错误可正确捕获和显示
- [ ] 通知系统可工作
- [ ] 性能指标达标（LCP < 2.5s）
- [ ] 文档完整

---

## 第三部分：关键风险与缓解策略

### 风险 1：状态管理复杂性

**风险**：无全局状态库，复杂状态机和工作流管理困难。

**严重程度**：HIGH

**缓解策略**：
1. 积极使用 URL 状态：过滤、分页、标签 → 搜索参数
2. 充分利用 Server Components：组件级数据获取
3. 必要时引入轻量级状态库：Zustand（2KB）
4. 文档化状态流模式：清晰的使用指南

**决策点**：如果 3+ 开发者在 2 个 sprint 后仍难以管理状态，引入 Zustand（违反规范，但务实）。

---

### 风险 2：Schema 版本管理

**风险**：Schema 变更破坏现有页面/表单。

**严重程度**：MEDIUM-HIGH

**缓解策略**：
1. Schema 语义版本：`user.v1.json`, `user.v2.json`
2. Schema 迁移系统：自动迁移旧 Schema 到新格式
3. 向后兼容层：支持旧 Schema 格式 2 个版本
4. Schema 验证：构建时验证（Zod/JSON Schema）

---

### 风险 3：大规模性能下降

**风险**：100+ Schema、1000+ 权限、复杂状态机导致系统变慢。

**严重程度**：MEDIUM

**缓解策略**：
1. 懒加载 Schema：按需加载
2. 权限索引：使用 Set 实现 O(1) 查询
3. 状态机编译：预编译状态机为查找表
4. 监控：添加性能指标（Schema 加载时间、权限检查时间）

---

### 风险 4：核心污染

**风险**：业务逻辑泄漏到 `core/` 目录，违反"Business-Agnostic"原则。

**严重程度**：HIGH（架构完整性）

**缓解策略**：
1. 严格 ESLint 规则：禁止 `core/` 导入 `features/`
2. 代码审查清单："这个 PR 修改了 core/？是否真正通用？"
3. 抽象层：`core/` 中使用接口/类型，`features/` 中实现
4. 文档：清晰示例说明什么属于 core vs. features

---

### 风险 5：AI 生成 UI 质量

**风险**：AI 从 Schema 生成的页面 UX 差或有 bug。

**严重程度**：MEDIUM

**缓解策略**：
1. Schema 验证：严格验证 Schema
2. 组件库限制：AI 仅限于组合预构建组件
3. 人工审查：AI 生成草稿，人工审查后部署
4. 反馈循环：追踪 AI 生成页面质量，改进 prompt

---

## 第四部分：成功判定标准

### 功能完整性

- [ ] 所有 7 个能力域都已实现
- [ ] Schema 系统可描述页面/表单/列表
- [ ] 状态机可驱动 UI 和业务流程
- [ ] 权限系统可控制所有操作
- [ ] 参考模块可独立运行

### 架构完整性

- [ ] 新业务模块不修改 `core/`
- [ ] 同一套运行时可承载多个 ERP 场景
- [ ] 可被 AI 自动生成部分前端
- [ ] 核心运行时稳定，边缘能力可变

### 性能指标

- [ ] LCP < 2.5s
- [ ] Schema 加载时间 < 100ms
- [ ] 权限检查时间 < 1ms
- [ ] 首屏渲染时间 < 3s

### 文档完整性

- [ ] 架构文档完整
- [ ] Schema 指南清晰
- [ ] 状态机指南清晰
- [ ] 参考实现示例充分

---

## 第五部分：后续迭代计划

### v1.1（第 11-12 周）

- [ ] AI 驱动的页面生成
- [ ] 高级筛选和搜索
- [ ] 批量操作
- [ ] 数据导出

### v1.2（第 13-14 周）

- [ ] 实时协作编辑
- [ ] 高级报表和分析
- [ ] 工作流自动化
- [ ] 移动端适配

### v2.0（长期）

- [ ] 低代码平台集成
- [ ] 多租户支持
- [ ] 高级权限模型（ABAC）
- [ ] 性能优化（虚拟化、预加载）

---

## 附录：核心代码模式

### 模式 1：状态机引擎

```typescript
class StateMachine {
  constructor(
    private definition: StateMachineDefinition,
    private currentState: string,
    private userPermissions: string[]
  ) {}

  canTransition(toState: string): boolean {
    const current = this.definition.states[this.currentState]
    if (!current) return false

    // 1. 检查状态机规则
    if (!current.transitions.includes(toState)) {
      return false
    }

    // 2. 检查权限
    const targetState = this.definition.states[toState]
    const requiredPerms = targetState.permissions.view

    return requiredPerms.every(p => this.userPermissions.includes(p))
  }

  getAllowedActions(): string[] {
    const current = this.definition.states[this.currentState]
    if (!current) return []

    return Object.entries(current.permissions.actions)
      .filter(([action, requiredPerms]) =>
        requiredPerms.every(p => this.userPermissions.includes(p))
      )
      .map(([action]) => action)
  }
}
```

### 模式 2：Schema Resolver

```typescript
class SchemaResolver {
  private cache = new Map<string, any>()

  async resolvePage(path: string): Promise<ResolvedPageSchema> {
    const cacheKey = `page:${path}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    const pageSchema = await this.load<PageSchema>(`pages/${path}`)
    const viewSchema = await this.load<ViewSchema>(`views/${pageSchema.view}`)
    const objectSchema = await this.load<ObjectSchema>(`objects/${viewSchema.object}`)

    const resolved: ResolvedPageSchema = {
      path: pageSchema.path,
      type: viewSchema.type,
      fields: this.resolveFields(objectSchema.fields, viewSchema.layout),
      permissions: this.mergePermissions([
        pageSchema.permissions,
        viewSchema.permissions,
        objectSchema.permissions
      ])
    }

    this.cache.set(cacheKey, resolved)
    return resolved
  }
}
```

### 模式 3：权限守卫

```typescript
class PermissionGuard {
  constructor(private context: PermissionContext) {}

  has(permission: string): boolean {
    return this.context.user.permissions.includes(permission)
  }

  canPerformAction(
    action: string,
    resourceState?: string
  ): boolean {
    if (resourceState) {
      const statePermission = `${resourceState}.${action}`
      if (this.has(statePermission)) return true
    }
    return this.has(action)
  }

  require(permission: string): void {
    if (!this.has(permission)) {
      throw new UnauthorizedError(`Missing permission: ${permission}`)
    }
  }
}
```

---

**规划完成。请审核上述规划，确认是否需要调整。**
