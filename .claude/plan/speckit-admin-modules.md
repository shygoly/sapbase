# 实现计划：Speckit ERP 核心管理模块

## 任务概述

实现 Speckit ERP 前端运行时的核心管理模块，包括用户管理、角色权限管理、部门管理、菜单管理、操作日志和系统设置。

**优先级**：架构性组件 > 业务功能

---

## 需求分析

### 功能需求

1. **用户管理** - 用户CRUD、状态管理、权限分配
2. **角色 & 权限管理** - RBAC系统、权限点定义、角色权限绑定
3. **部门管理** - 组织树、部门CRUD、部门与用户关联
4. **菜单管理** - 动态菜单、权限驱动菜单、菜单与路由解耦
5. **操作日志查看** - 审计日志展示、日志查询、日志详情
6. **系统设置** - 系统参数配置、主题设置、国际化设置

### 技术约束

- Framework: Next.js 15 (App Router)
- UI: shadcn/ui + Tailwind CSS
- State: React Context (系统级) + API (业务数据)
- Auth: JWT + RBAC
- Types: shared-schemas (已集成)

### 当前状态

- ✅ 后端API已实现 (users, departments, roles, auth)
- ✅ 前端核心模块已有 (auth, navigation, organization)
- ✅ shared-schemas已集成
- ❌ 前端管理页面未实现
- ❌ MainLayout未实现

---

## 实现计划

### Phase 1: 架构性组件（优先级最高）

#### 1.1 MainLayout 主布局

**文件**: `src/layouts/main-layout.tsx`

**职责**:
- 集成 Sidebar + Header + Content 区域
- 权限检查（ProtectedLayout）
- 响应式设计（桌面/平板/手机）

**实现步骤**:
1. 创建 MainLayout 组件框架
2. 集成 Sidebar 和 Header
3. 添加权限检查逻辑
4. 实现响应式布局

**预期输出**:
```tsx
export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
```

---

#### 1.2 Sidebar 左侧导航栏

**文件**: `src/layouts/sidebar.tsx`

**职责**:
- 从 API 获取菜单树
- 权限过滤菜单项
- 高亮当前路由
- 菜单折叠/展开

**实现步骤**:
1. 创建 Sidebar 组件
2. 集成 MenuResolver 获取菜单
3. 实现权限过滤
4. 实现路由高亮
5. 实现菜单折叠

**关键依赖**:
- `src/core/navigation/menu-resolver.ts`
- `src/core/auth/hooks.ts` (usePermission)

---

#### 1.3 Header 顶部导航栏

**文件**: `src/layouts/header.tsx`

**职责**:
- 面包屑导航
- 用户菜单（头像、设置、登出）
- 搜索框

**实现步骤**:
1. 创建 Header 组件
2. 实现面包屑导航
3. 实现用户菜单
4. 实现搜索框

---

#### 1.4 权限守卫增强

**文件**: `src/core/auth/permission-guard.ts`

**职责**:
- 路由级权限检查
- 组件级权限检查
- 操作级权限检查

**实现步骤**:
1. 增强 PermissionGuard 类
2. 添加路由级检查方法
3. 添加组件级检查方法
4. 添加操作级检查方法

---

### Phase 2: 业务功能模块

#### 2.1 用户管理

**文件结构**:
```
src/features/users/
├── page.tsx              # 用户列表页
├── [id]/
│   └── page.tsx          # 用户详情/编辑页
├── api.ts                # API 调用
├── components/
│   ├── user-table.tsx    # 用户表格
│   ├── user-form.tsx     # 用户表单
│   └── user-dialog.tsx   # 用户对话框
└── hooks.ts              # 自定义 hooks
```

**功能**:
- 用户列表（分页、搜索、排序）
- 创建用户
- 编辑用户
- 删除用户
- 批量操作
- 权限分配

**实现步骤**:
1. 创建用户列表页面
2. 实现用户表格组件
3. 实现用户表单组件
4. 实现 API 调用
5. 实现权限分配功能

---

#### 2.2 角色管理

**文件结构**:
```
src/features/roles/
├── page.tsx              # 角色列表页
├── [id]/
│   └── page.tsx          # 角色详情/编辑页
├── api.ts                # API 调用
├── components/
│   ├── role-table.tsx    # 角色表格
│   ├── role-form.tsx     # 角色表单
│   └── permission-selector.tsx  # 权限选择器
└── hooks.ts              # 自定义 hooks
```

**功能**:
- 角色列表
- 创建角色
- 编辑角色
- 删除角色
- 权限绑定

---

#### 2.3 部门管理

**文件结构**:
```
src/features/departments/
├── page.tsx              # 部门列表页
├── [id]/
│   └── page.tsx          # 部门详情/编辑页
├── api.ts                # API 调用
├── components/
│   ├── department-tree.tsx   # 部门树
│   ├── department-form.tsx   # 部门表单
│   └── department-dialog.tsx # 部门对话框
└── hooks.ts              # 自定义 hooks
```

**功能**:
- 部门树展示
- 创建部门
- 编辑部门
- 删除部门
- 部门与用户关联

---

#### 2.4 操作日志

**文件结构**:
```
src/features/audit-logs/
├── page.tsx              # 日志列表页
├── [id]/
│   └── page.tsx          # 日志详情页
├── api.ts                # API 调用
├── components/
│   ├── audit-log-table.tsx   # 日志表格
│   ├── audit-log-filter.tsx  # 日志过滤
│   └── audit-log-detail.tsx  # 日志详情
└── hooks.ts              # 自定义 hooks
```

**功能**:
- 日志列表（分页、搜索、排序）
- 日志过滤
- 日志详情展示
- 日志导出

---

#### 2.5 系统设置

**文件结构**:
```
src/features/system-settings/
├── page.tsx              # 设置页面
├── api.ts                # API 调用
├── components/
│   ├── appearance-settings.tsx   # 外观设置
│   ├── localization-settings.tsx # 本地化设置
│   ├── notification-settings.tsx # 通知设置
│   └── security-settings.tsx     # 安全设置
└── hooks.ts              # 自定义 hooks
```

**功能**:
- 主题设置
- 语言设置
- 通知设置
- 安全设置

---

### Phase 3: 路由配置

**文件**: `src/app/admin/layout.tsx`

```tsx
export default function AdminLayout({
  children
}: {
  children: React.ReactNode
}) {
  return <MainLayout>{children}</MainLayout>
}
```

**路由结构**:
```
/admin/
├── /users              # 用户管理
├── /roles              # 角色管理
├── /departments        # 部门管理
├── /audit-logs         # 操作日志
└── /settings           # 系统设置
```

---

## 关键技术决策

### 1. 状态管理

- **系统级状态**: React Context (auth, theme, notification)
- **业务数据**: API + SWR/React Query (用户、角色、部门)
- **表单状态**: React Hook Form

### 2. 权限检查

- **路由级**: ProtectedRoute 组件
- **组件级**: usePermission hook
- **操作级**: 按钮/菜单项的 disabled 状态

### 3. 数据获取

- **列表数据**: API + 分页
- **详情数据**: API + 缓存
- **菜单数据**: API + 缓存

### 4. 表单验证

- **前端验证**: React Hook Form + Zod
- **后端验证**: NestJS class-validator

---

## 实现顺序

1. **第1周**: MainLayout + Sidebar + Header (架构)
2. **第2周**: 用户管理 + 角色管理 (核心业务)
3. **第3周**: 部门管理 + 操作日志 (扩展功能)
4. **第4周**: 系统设置 + 菜单管理 (完善功能)

---

## 风险与缓解

| 风险 | 缓解方案 |
|------|--------|
| 权限检查不完整 | 在每个操作前都检查权限 |
| 菜单加载缓慢 | 实现菜单缓存和预加载 |
| 表单验证不一致 | 使用 shared-schemas 统一验证规则 |
| 性能问题 | 实现虚拟滚动、分页、懒加载 |

---

## 成功标准

- ✅ MainLayout 完整实现，支持权限检查
- ✅ 所有管理模块都能正常CRUD
- ✅ 权限系统完整，菜单权限驱动
- ✅ 操作日志完整记录
- ✅ 系统设置可配置
- ✅ 响应式设计支持移动端

---

## 下一步

1. 审核此计划
2. 确认实现顺序
3. 开始 Phase 1 实现
4. 定期检查进度

---

**计划生成时间**: 2026-02-08
**版本**: v1.0
