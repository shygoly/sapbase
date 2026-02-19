# CRM 模块集成说明

## 概述

CRM 模块已成功集成到现有系统中，与原有的登录、用户管理、系统管理等功能共存。

## 集成内容

### 1. 菜单集成

CRM 模块已添加到侧边栏导航菜单中，位于"CRM管理"分组下：

- **客户管理** (`/crm/customers`) - 客户列表和表单
- **订单管理** (`/crm/orders`) - 订单列表和表单  
- **资金往来** (`/crm/transactions`) - 交易列表和表单

### 2. 保留的原有功能

所有原有功能保持不变：

- ✅ **登录页面** (`/login`) - 用户认证
- ✅ **仪表板** (`/dashboard/overview`) - 系统概览
- ✅ **用户管理** (`/admin/users`) - 系统用户管理
- ✅ **科室管理** (`/admin/departments`) - 部门管理
- ✅ **角色权限** (`/admin/roles`) - 权限管理
- ✅ **菜单管理** (`/admin/menu`) - 菜单配置
- ✅ **审计日志** (`/admin/audit-logs`) - 操作日志
- ✅ **系统配置** (`/admin/settings`) - 系统设置

### 3. 菜单结构

```
仪表板 (/dashboard/overview)
├── CRM管理
│   ├── 客户管理 (/crm/customers)
│   ├── 订单管理 (/crm/orders)
│   └── 资金往来 (/crm/transactions)
└── 系统管理
    ├── 用户管理 (/admin/users)
    ├── 科室管理 (/admin/departments)
    ├── 角色权限 (/admin/roles)
    ├── 菜单管理 (/admin/menu)
    ├── 审计日志 (/admin/audit-logs)
    └── 系统配置 (/admin/settings)
```

## 技术实现

### 菜单配置

菜单项定义在 `src/config/default-menu-items.ts`：

```typescript
export const defaultMenuItems: UnifiedMenuItem[] = [
  {
    id: 'dashboard',
    label: '仪表板',
    path: '/dashboard/overview',
    icon: 'dashboard',
    order: 1,
  },
  {
    id: 'crm',
    label: 'CRM管理',
    icon: 'users',
    order: 2,
    children: [
      // CRM 子菜单项
    ],
  },
  {
    id: 'admin',
    label: '系统管理',
    icon: 'settings',
    order: 3,
    children: [
      // 原有管理功能
    ],
  },
]
```

### Layout 集成

Dashboard Layout (`src/app/dashboard/layout.tsx`) 已更新，使用默认菜单项：

```typescript
<UnifiedSidebar source="static" staticItems={defaultMenuItems} />
```

## 访问路径

### CRM 模块
- 客户列表：`http://localhost:3050/crm/customers`
- 新建客户：`http://localhost:3050/crm/customers/new`
- 编辑客户：`http://localhost:3050/crm/customers/:id/edit`
- 订单列表：`http://localhost:3050/crm/orders` (待创建)
- 交易列表：`http://localhost:3050/crm/transactions` (待创建)

### 原有功能
- 登录：`http://localhost:3050/login`
- 仪表板：`http://localhost:3050/dashboard/overview`
- 用户管理：`http://localhost:3050/admin/users`
- 其他管理功能：`http://localhost:3050/admin/*`

## 权限控制

CRM 模块的权限配置：

- **客户管理**：`admin`, `sales`, `manager`
- **订单管理**：`admin`, `sales`, `manager`
- **资金往来**：`admin`, `sales`, `manager`, `accountant`

原有功能的权限保持不变。

## Schema 文件位置

CRM 模块的 Schema 文件：

```
speckit/public/specs/
├── objects/
│   ├── customer.json
│   ├── order.json
│   ├── order-tracking.json
│   └── financial-transaction.json
├── views/
│   ├── customer-list.json
│   ├── customer-form.json
│   ├── order-list.json
│   ├── order-form.json
│   ├── order-tracking-list.json
│   ├── transaction-list.json
│   └── transaction-form.json
└── pages/
    ├── customers.json
    ├── customers-create.json
    ├── customers-edit.json
    ├── orders.json
    ├── orders-create.json
    ├── orders-edit.json
    ├── orders-tracking.json
    ├── transactions.json
    └── transactions-create.json
```

## 测试验证

### 已验证功能

1. ✅ 原有登录页面正常
2. ✅ 原有用户管理页面正常
3. ✅ 原有仪表板正常
4. ✅ CRM 客户列表页面正常
5. ✅ CRM 新建客户表单正常
6. ✅ 菜单集成正常（CRM 和原有功能都在侧边栏）

### 待创建页面

- `/crm/orders` - 订单列表页面
- `/crm/orders/new` - 新建订单页面
- `/crm/orders/:id/edit` - 编辑订单页面
- `/crm/orders/:id/tracking` - 订单跟踪页面
- `/crm/transactions` - 交易列表页面
- `/crm/transactions/new` - 新建交易页面

## 下一步

1. 创建订单和交易相关的页面文件
2. 测试完整的 CRM 工作流
3. 集成后端 API（端口 3051）
4. 测试 Patch DSL 功能（使用 Kimi API）

## 注意事项

- CRM 模块使用 Schema 驱动架构，所有 UI 都从 JSON Schema 生成
- 可以通过 Patch DSL 扩展 CRM 模块，无需修改代码
- 所有原有功能保持不变，CRM 是新增功能，不会影响现有系统
